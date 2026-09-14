import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, IconButton, Stack, Typography } from '@mui/material';
import { Pause, PlayArrow } from '@mui/icons-material';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import loadMujoco, { MainModule } from '@mujoco/mujoco';
import mujocoWasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import type { Episode } from '../types';

export type MujocoTrajectoryState = {
  qpos: number[];
  qvel: number[];
};

export type MujocoTrajectoryResponse = {
  env_name: string;
  states: MujocoTrajectoryState[];
};

export type MujocoModelManifest = {
  env_name: string;
  root_xml: string;
  files: string[];
};

type MujocoTrajectoryViewerProps = {
  episode: Episode;
  backgroundEpisodes?: Episode[];
  selectedStep: number;
  onStepChange?: (step: number) => void;
  fallback: React.ReactNode;
  trajectoryColor?: string;
  getBackgroundTrajectoryColor?: (episode: Episode) => string;
};

let mujocoPromise: Promise<MainModule> | null = null;

export const getMujoco = () => {
  if (!mujocoPromise) {
    mujocoPromise = loadMujoco({
      locateFile: (fileName: string) => (fileName.endsWith('.wasm') ? mujocoWasmUrl : fileName),
    });
  }
  return mujocoPromise;
};

export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
  up?: [number, number, number];
  fov?: number;
};

let persistedCameraPose: CameraPose | null = null;

const DEFAULT_CAMERA_POSE: CameraPose = {
  position: [0.95, -0.72, 0.82],
  target: [0, 0.64, 0.16],
  up: [0, 0, 1],
  fov: 42,
};

// MetaWorld's fixed `corner` camera after the 180-degree frame rotation applied
// by the Python recorder for this camera.
export const CORNER_VIDEO_CAMERA_POSE: CameraPose = {
  position: [-1.1, -0.4, 0.6],
  target: [-0.079379, 0.620621, 0.191752],
  up: [0.19245, 0.19245, 0.96225],
  fov: 45,
};

class CapsuleGeometry extends THREE.BufferGeometry {
  constructor(radius = 1, length = 1, capSegments = 4, radialSegments = 8) {
    super();
    const path = new THREE.Path();
    path.absarc(0, -length / 2, radius, Math.PI * 1.5, 0, false);
    path.absarc(0, length / 2, radius, 0, Math.PI * 0.5, false);
    const latheGeometry = new THREE.LatheGeometry(path.getPoints(capSegments), radialSegments);
    this.setIndex(latheGeometry.getIndex());
    this.setAttribute('position', latheGeometry.getAttribute('position'));
    this.setAttribute('normal', latheGeometry.getAttribute('normal'));
    this.setAttribute('uv', latheGeometry.getAttribute('uv'));
  }
}

export class MujocoSceneRenderer {
  private readonly mujoco: MainModule;
  private readonly model: any;
  private readonly data: any;
  private readonly objectGeomId: number;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly option: any;
  private readonly perturb: any;
  private readonly mjCamera: any;
  private readonly mjScene: any;
  private readonly meshes: THREE.Mesh[] = [];
  private readonly geometryCache = new Map<string, THREE.BufferGeometry>();
  private readonly textureCache = new Map<string, THREE.Texture>();
  private readonly backgroundTrajectoryLines: THREE.Mesh[] = [];
  private trajectoryLine: THREE.Mesh | null = null;
  private readonly trajectoryMarker: THREE.Mesh;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly persistCameraPose: boolean;

  constructor(
    mujoco: MainModule,
    model: any,
    data: any,
    container: HTMLDivElement,
    tcpPoints: THREE.Vector3[],
    backgroundTrajectories: Array<{ points: THREE.Vector3[]; color: string }>,
    trajectoryColor = '#ff6b35',
    initialCameraPose?: CameraPose,
    persistCameraPose = true,
  ) {
    this.mujoco = mujoco;
    this.model = model;
    this.data = data;
    this.objectGeomId = (mujoco as any).mj_name2id(
      model,
      (mujoco as any).mjtObj.mjOBJ_GEOM.value,
      'objGeom',
    );
    this.option = new (mujoco as any).MjvOption();
    this.perturb = new (mujoco as any).MjvPerturb();
    this.mjCamera = new (mujoco as any).MjvCamera();
    this.mjScene = new (mujoco as any).MjvScene(model, 2 ** 15);

    this.scene.background = new THREE.Color(0xf4f5f7);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // setSize(..., false) deliberately leaves CSS sizing to the layout. Without
    // these rules, the canvas uses its high-DPI drawing-buffer dimensions as its
    // displayed size and gets clipped by the responsive container on DPR > 1.
    Object.assign(this.renderer.domElement.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      maxWidth: '100%',
      maxHeight: '100%',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const cameraPose = initialCameraPose ?? persistedCameraPose ?? DEFAULT_CAMERA_POSE;
    this.camera = new THREE.PerspectiveCamera(cameraPose.fov ?? 42, 1, 0.01, 100);
    this.camera.up.fromArray(cameraPose.up ?? [0, 0, 1]);
    this.camera.position.fromArray(cameraPose.position);
    this.persistCameraPose = persistCameraPose;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.fromArray(cameraPose.target);
    this.controls.enableDamping = true;
    if (this.persistCameraPose) {
      this.controls.addEventListener('change', this.saveCameraPose);
    }

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x52606d, 1.15));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(-1.5, -2, 3);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    backgroundTrajectories.forEach(({ points, color }) => {
      const backgroundLine = this.createTrajectoryPath(points, color, 0.0015, 0.4);
      if (backgroundLine) {
        this.backgroundTrajectoryLines.push(backgroundLine);
        this.scene.add(backgroundLine);
      }
    });

    this.trajectoryLine = this.createTrajectoryPath(tcpPoints, trajectoryColor, 0.003, 0.96);
    if (this.trajectoryLine) {
      this.scene.add(this.trajectoryLine);
    }

    this.trajectoryMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.021, 20, 20),
      new THREE.MeshBasicMaterial({ color: trajectoryColor, depthTest: false }),
    );
    this.trajectoryMarker.renderOrder = 11;
    this.scene.add(this.trajectoryMarker);

    this.resizeObserver = new ResizeObserver(() => this.resize(container));
    this.resizeObserver.observe(container);
    this.resize(container);
    this.renderLoop();
  }

  setTrajectory(points: THREE.Vector3[], color?: string) {
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine.geometry.dispose();
      (this.trajectoryLine.material as THREE.Material).dispose();
    }
    const markerMaterial = this.trajectoryMarker.material as THREE.MeshBasicMaterial;
    if (color) {
      markerMaterial.color.set(color);
    }
    this.trajectoryLine = this.createTrajectoryPath(
      points,
      color ?? `#${markerMaterial.color.getHexString()}`,
      0.006,
      0.96,
    );
    if (this.trajectoryLine) {
      this.scene.add(this.trajectoryLine);
    }
  }

  setState(state: MujocoTrajectoryState, tcpPoint?: THREE.Vector3) {
    this.data.qpos.set(state.qpos);
    this.data.qvel.set(state.qvel);
    (this.mujoco as any).mj_forward(this.model, this.data);
    this.trajectoryMarker.position.copy(tcpPoint ?? getTcpPoint(this.data));
    this.updateSceneMeshes();
  }

  refresh(tcpPoint?: THREE.Vector3) {
    (this.mujoco as any).mj_forward(this.model, this.data);
    this.trajectoryMarker.position.copy(tcpPoint ?? getTcpPoint(this.data));
    this.updateSceneMeshes();
  }

  private createTrajectoryPath(
    points: THREE.Vector3[],
    color: string,
    radius: number,
    opacity: number,
  ): THREE.Mesh | null {
    if (points.length < 2) {
      return null;
    }
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const geometry = new THREE.TubeGeometry(
      curve,
      Math.max(8, Math.min(points.length * 2, 600)),
      radius,
      6,
      false,
    );
    const path = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
      }),
    );
    path.renderOrder = opacity >= 0.9 ? 10 : 9;
    return path;
  }

  dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.resizeObserver?.disconnect();
    if (this.persistCameraPose) {
      this.saveCameraPose();
      this.controls.removeEventListener('change', this.saveCameraPose);
    }
    this.controls.dispose();
    this.meshes.forEach((mesh) => {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.trajectoryLine?.geometry.dispose();
    if (this.trajectoryLine) {
      (this.trajectoryLine.material as THREE.Material).dispose();
    }
    this.backgroundTrajectoryLines.forEach((line) => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.trajectoryMarker.geometry.dispose();
    (this.trajectoryMarker.material as THREE.Material).dispose();
    this.geometryCache.forEach((geometry) => geometry.dispose());
    this.textureCache.forEach((texture) => texture.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.mjScene.delete();
    this.mjCamera.delete();
    this.perturb.delete();
    this.option.delete();
  }

  private saveCameraPose = () => {
    persistedCameraPose = {
      position: this.camera.position.toArray() as [number, number, number],
      target: this.controls.target.toArray() as [number, number, number],
      up: this.camera.up.toArray() as [number, number, number],
      fov: this.camera.fov,
    };
  };

  private resize(container: HTMLDivElement) {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (this.renderer.getPixelRatio() !== pixelRatio) {
      this.renderer.setPixelRatio(pixelRatio);
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private renderLoop = () => {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  private updateSceneMeshes() {
    (this.mujoco as any).mjv_updateScene(
      this.model,
      this.data,
      this.option,
      this.perturb,
      this.mjCamera,
      (this.mujoco as any).mjtCatBit.mjCAT_ALL.value,
      this.mjScene,
    );

    const geoms = this.mjScene.geoms;
    for (let index = 0; index < geoms.size(); index += 1) {
      const mjvGeom = geoms.get(index);
      let mesh = this.meshes[index];
      if (!mesh) {
        mesh = new THREE.Mesh(this.getGeometry(mjvGeom), this.getMaterial(mjvGeom));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        this.meshes.push(mesh);
        this.scene.add(mesh);
      }

      mesh.visible = true;
      mesh.matrix.set(
        mjvGeom.mat[0], mjvGeom.mat[1], mjvGeom.mat[2], mjvGeom.pos[0],
        mjvGeom.mat[3], mjvGeom.mat[4], mjvGeom.mat[5], mjvGeom.pos[1],
        mjvGeom.mat[6], mjvGeom.mat[7], mjvGeom.mat[8], mjvGeom.pos[2],
        0, 0, 0, 1,
      );
      mesh.matrixWorldNeedsUpdate = true;
      mjvGeom.delete();
    }

    for (let index = geoms.size(); index < this.meshes.length; index += 1) {
      this.meshes[index].visible = false;
    }
    geoms.delete();
  }

  private getMaterial(mjvGeom: any) {
    const isTaskObject =
      mjvGeom.objtype === (this.mujoco as any).mjtObj.mjOBJ_GEOM.value
      && mjvGeom.objid === this.objectGeomId;
    const material = new THREE.MeshStandardMaterial({
      color: isTaskObject
        ? new THREE.Color(0xf5f7fa)
        : new THREE.Color(mjvGeom.rgba[0], mjvGeom.rgba[1], mjvGeom.rgba[2]),
      opacity: mjvGeom.rgba[3],
      transparent: mjvGeom.rgba[3] < 1,
      roughness: isTaskObject
        ? 0.48
        : (mjvGeom.matid >= 0 ? this.model.mat_roughness[mjvGeom.matid] : 0.65),
      metalness: isTaskObject
        ? 0
        : (mjvGeom.matid >= 0 ? this.model.mat_metallic[mjvGeom.matid] : 0.08),
      side:
        mjvGeom.type === (this.mujoco as any).mjtGeom.mjGEOM_MESH.value
          ? THREE.DoubleSide
          : THREE.FrontSide,
    });

    const colorTexture = isTaskObject
      ? null
      : this.getColorTexture(mjvGeom.matid, mjvGeom.type);
    if (colorTexture) {
      material.map = colorTexture;
    }

    return material;
  }

  private getGeometry(mjvGeom: any): THREE.BufferGeometry {
    const geomTypes = (this.mujoco as any).mjtGeom;
    const meshId = mjvGeom.type === geomTypes.mjGEOM_MESH.value ? this.getMeshId(mjvGeom) : -1;
    const key = JSON.stringify([mjvGeom.type, Array.from(mjvGeom.size), meshId >= 0 ? meshId : mjvGeom.dataid]);
    const cached = this.geometryCache.get(key);
    if (cached) {
      return cached;
    }

    let geometry: THREE.BufferGeometry;
    switch (mjvGeom.type) {
      case geomTypes.mjGEOM_PLANE.value:
        geometry = new THREE.PlaneGeometry(
          2 * (mjvGeom.size[0] || 4),
          2 * (mjvGeom.size[1] || 4),
        );
        this.flipUvY(geometry);
        break;
      case geomTypes.mjGEOM_SPHERE.value:
        geometry = new THREE.SphereGeometry(mjvGeom.size[0], 24, 16);
        break;
      case geomTypes.mjGEOM_CAPSULE.value:
        geometry = new CapsuleGeometry(mjvGeom.size[0], 2 * mjvGeom.size[2], 24, 12);
        geometry.rotateX(0.5 * Math.PI);
        break;
      case geomTypes.mjGEOM_BOX.value:
        geometry = new THREE.BoxGeometry(
          2 * mjvGeom.size[0],
          2 * mjvGeom.size[1],
          2 * mjvGeom.size[2],
        );
        break;
      case geomTypes.mjGEOM_CYLINDER.value:
        geometry = new THREE.CylinderGeometry(mjvGeom.size[0], mjvGeom.size[0], 2 * mjvGeom.size[2], 24);
        geometry.rotateX(0.5 * Math.PI);
        break;
      case geomTypes.mjGEOM_ELLIPSOID.value:
        geometry = new THREE.SphereGeometry(1, 24, 16);
        geometry.scale(mjvGeom.size[0], mjvGeom.size[1], mjvGeom.size[2]);
        break;
      case geomTypes.mjGEOM_MESH.value:
        geometry = meshId >= 0 ? this.getMeshGeometry(meshId) : new THREE.BufferGeometry();
        break;
      default:
        geometry = new THREE.BufferGeometry();
        break;
    }

    this.geometryCache.set(key, geometry);
    return geometry;
  }

  private getMeshId(mjvGeom: any) {
    const objectTypes = (this.mujoco as any).mjtObj;
    if (
      mjvGeom.objtype === objectTypes.mjOBJ_GEOM.value &&
      mjvGeom.objid >= 0 &&
      mjvGeom.objid < this.model.ngeom
    ) {
      return this.model.geom_dataid[mjvGeom.objid];
    }
    return mjvGeom.dataid;
  }

  private getMeshGeometry(meshId: number) {
    const faceStart = this.model.mesh_faceadr[meshId] * 3;
    const faceCornerCount = this.model.mesh_facenum[meshId] * 3;
    const vertexStart = this.model.mesh_vertadr[meshId] * 3;
    const normalStart = this.model.mesh_normaladr[meshId] * 3;
    const texcoordStart = this.model.mesh_texcoordadr[meshId] * 2;
    const hasNormals = this.model.mesh_normaladr[meshId] >= 0 && this.model.mesh_normalnum[meshId] > 0;
    const hasTexcoords = this.model.mesh_texcoordadr[meshId] >= 0 && this.model.mesh_texcoordnum[meshId] > 0;
    const positions = new Float32Array(faceCornerCount * 3);
    const normals = hasNormals ? new Float32Array(faceCornerCount * 3) : null;
    const uvs = hasTexcoords ? new Float32Array(faceCornerCount * 2) : null;

    for (let cornerIndex = 0; cornerIndex < faceCornerCount; cornerIndex += 1) {
      const vertexIndex = this.model.mesh_face[faceStart + cornerIndex];
      positions[cornerIndex * 3] = this.model.mesh_vert[vertexStart + vertexIndex * 3];
      positions[cornerIndex * 3 + 1] = this.model.mesh_vert[vertexStart + vertexIndex * 3 + 1];
      positions[cornerIndex * 3 + 2] = this.model.mesh_vert[vertexStart + vertexIndex * 3 + 2];

      if (normals) {
        const normalIndex = this.model.mesh_facenormal[faceStart + cornerIndex];
        normals[cornerIndex * 3] = this.model.mesh_normal[normalStart + normalIndex * 3];
        normals[cornerIndex * 3 + 1] = this.model.mesh_normal[normalStart + normalIndex * 3 + 1];
        normals[cornerIndex * 3 + 2] = this.model.mesh_normal[normalStart + normalIndex * 3 + 2];
      }

      if (uvs) {
        const texcoordIndex = this.model.mesh_facetexcoord[faceStart + cornerIndex];
        uvs[cornerIndex * 2] = this.model.mesh_texcoord[texcoordStart + texcoordIndex * 2];
        uvs[cornerIndex * 2 + 1] = 1 - this.model.mesh_texcoord[texcoordStart + texcoordIndex * 2 + 1];
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      geometry.computeVertexNormals();
    }
    if (uvs) {
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
    return geometry;
  }

  private getColorTexture(materialId: number, geomType: number) {
    if (materialId < 0) {
      return null;
    }

    const textureRoles = (this.mujoco as any).mjtTextureRole;
    const roleCount = textureRoles.mjNTEXROLE.value;
    const rgbTextureId = this.model.mat_texid[materialId * roleCount + textureRoles.mjTEXROLE_RGB.value];
    const rgbaTextureId = this.model.mat_texid[materialId * roleCount + textureRoles.mjTEXROLE_RGBA.value];
    const textureId = rgbTextureId >= 0 ? rgbTextureId : rgbaTextureId;
    if (textureId < 0) {
      return null;
    }
    const textureTypes = (this.mujoco as any).mjtTexture;
    const textureType = this.model.tex_type[textureId];
    if (textureType === textureTypes.mjTEXTURE_SKYBOX.value) {
      return null;
    }
    if (
      geomType === (this.mujoco as any).mjtGeom.mjGEOM_MESH.value &&
      textureType !== textureTypes.mjTEXTURE_2D.value
    ) {
      return null;
    }

    const repeatX = this.model.mat_texrepeat[materialId * 2] || 1;
    const repeatY = this.model.mat_texrepeat[materialId * 2 + 1] || 1;
    const cacheKey = `${textureId}:${textureType}:${repeatX}:${repeatY}`;
    const cached = this.textureCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const width = this.model.tex_width[textureId];
    const height = this.model.tex_height[textureId];
    const channelCount = this.model.tex_nchannel[textureId];
    const start = Number(this.model.tex_adr[textureId]);
    const source = this.model.tex_data.slice(start, start + width * height * channelCount);
    const rgba = new Uint8Array(width * height * 4);
    for (let sourceIndex = 0, targetIndex = 0; sourceIndex < source.length; sourceIndex += channelCount) {
      rgba[targetIndex] = source[sourceIndex];
      rgba[targetIndex + 1] = source[channelCount > 1 ? sourceIndex + 1 : sourceIndex];
      rgba[targetIndex + 2] = source[channelCount > 2 ? sourceIndex + 2 : sourceIndex];
      rgba[targetIndex + 3] = channelCount > 3 ? source[sourceIndex + 3] : 255;
      targetIndex += 4;
    }

    const texture = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  private flipUvY(geometry: THREE.BufferGeometry) {
    const uv = geometry.getAttribute('uv');
    if (!uv) {
      return;
    }
    for (let index = 0; index < uv.count; index += 1) {
      uv.setY(index, 1 - uv.getY(index));
    }
    uv.needsUpdate = true;
  }
}

export const getTcpPoint = (data: any) => {
  const right = data.site('rightEndEffector').xpos;
  const left = data.site('leftEndEffector').xpos;
  return new THREE.Vector3(
    (right[0] + left[0]) / 2,
    (right[1] + left[1]) / 2,
    (right[2] + left[2]) / 2,
  );
};

export const writeBundleFiles = async (mujoco: MainModule, manifest: MujocoModelManifest) => {
  const fs = (mujoco as any).FS;
  const getVirtualPaths = (filePath: string) => {
    const paths = [`/metaworld/${filePath}`];
    // Some MetaWorld include files under objects/assets refer to assets as if
    // paths were resolved from the top-level XML, while MuJoCo resolves them
    // relative to the included XML. Mirror these files into the include-relative
    // location so the browser FS behaves like MetaWorld's Python loader.
    if (filePath.startsWith('objects/meshes/') || filePath.startsWith('textures/')) {
      paths.push(`/metaworld/objects/${filePath}`);
    }
    return paths;
  };

  await Promise.all(
    manifest.files.map(async (filePath) => {
      const response = await fetch(
        `/data/get_mujoco_asset_file?env_name=${encodeURIComponent(manifest.env_name)}&path=${encodeURIComponent(filePath)}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch MuJoCo asset ${filePath}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      getVirtualPaths(filePath).forEach((virtualPath) => {
        const directory = virtualPath.slice(0, virtualPath.lastIndexOf('/'));
        fs.mkdirTree(directory);
        fs.writeFile(virtualPath, bytes);
      });
    }),
  );
};

export const loadTrajectory = async (episode: Episode) => {
  const params = new URLSearchParams({
    env_name: episode.env_name,
    benchmark_id: String(episode.benchmark_id),
    checkpoint_step: String(episode.checkpoint_step),
    episode_num: String(episode.episode_num),
  });
  const response = await fetch(`/data/get_mujoco_trajectory?${params.toString()}`);
  if (!response.ok) {
    throw new Error('No browser trajectory available');
  }
  return (await response.json()) as MujocoTrajectoryResponse;
};

export const loadManifest = async (envName: string) => {
  const response = await fetch(`/data/get_mujoco_model_manifest?env_name=${encodeURIComponent(envName)}`);
  if (!response.ok) {
    throw new Error('No browser model bundle available');
  }
  return (await response.json()) as MujocoModelManifest;
};

const clampStep = (step: number, maxStep: number) => Math.max(0, Math.min(step, maxStep));

const getEpisodeKey = (episode: Episode) =>
  [
    episode.env_name,
    episode.benchmark_id,
    episode.checkpoint_step,
    episode.episode_num,
  ].join(':');

export const getTrajectoryTcpPoints = (
  mujoco: MainModule,
  model: any,
  data: any,
  states: MujocoTrajectoryState[],
) =>
  states.map((state: MujocoTrajectoryState) => {
    data.qpos.set(state.qpos);
    data.qvel.set(state.qvel);
    (mujoco as any).mj_forward(model, data);
    return getTcpPoint(data);
  });

const getNamedPosition = (data: any, type: 'body' | 'site', name: string): number[] => {
  try {
    return Array.from(data[type](name).xpos as ArrayLike<number>);
  } catch {
    return [0, 0, 0];
  }
};

export const getMujocoObservation = (
  envName: string,
  data: any,
  previousObservation?: number[],
): number[] => {
  if (envName.toLowerCase().includes('sweep-into')) {
    const tcp = getTcpPoint(data).toArray();
    const rightClaw = getNamedPosition(data, 'body', 'rightclaw');
    const leftClaw = getNamedPosition(data, 'body', 'leftclaw');
    const gripperDistance = Math.min(
      1,
      new THREE.Vector3(...(rightClaw as [number, number, number])).distanceTo(
        new THREE.Vector3(...(leftClaw as [number, number, number])),
      ) / 0.1,
    );
    const objectPosition = getNamedPosition(data, 'body', 'obj');
    let objectQuaternion = [0, 0, 0, 1];
    try {
      const xmat = Array.from(data.geom('objGeom').xmat as ArrayLike<number>);
      const rotation = new THREE.Matrix4().set(
        xmat[0], xmat[1], xmat[2], 0,
        xmat[3], xmat[4], xmat[5], 0,
        xmat[6], xmat[7], xmat[8], 0,
        0, 0, 0, 1,
      );
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotation);
      objectQuaternion = quaternion.toArray();
    } catch {
      // Keep the identity quaternion when the task-specific geom is unavailable.
    }
    const current = [
      ...tcp,
      gripperDistance,
      ...objectPosition,
      ...objectQuaternion,
      ...new Array(7).fill(0),
    ];
    const previous = previousObservation?.slice(0, 18) ?? current;
    return [...current, ...previous, 0, 0.84, 0.02];
  }

  const raw = [...Array.from(data.qpos as ArrayLike<number>), ...Array.from(data.qvel as ArrayLike<number>)];
  return [...raw.slice(0, 39), ...new Array(Math.max(0, 39 - raw.length)).fill(0)];
};

export const stepMujocoSimulation = (
  mujoco: MainModule,
  model: any,
  data: any,
  action: number[],
) => {
  const clipped = action.map((value) => Math.max(-1, Math.min(1, value)));
  if (data.mocap_pos?.length >= 3) {
    const lower = [-0.5, 0.4, 0.05];
    const upper = [0.5, 1, 0.5];
    for (let axis = 0; axis < 3; axis += 1) {
      data.mocap_pos[axis] = Math.max(
        lower[axis],
        Math.min(upper[axis], data.mocap_pos[axis] + clipped[axis] * 0.01),
      );
    }
  }
  if (data.mocap_quat?.length >= 4) {
    data.mocap_quat.set([1, 0, 1, 0]);
  }
  if (data.ctrl?.length >= 2) {
    data.ctrl[0] = clipped[3];
    data.ctrl[1] = -clipped[3];
  }
  for (let frame = 0; frame < 5; frame += 1) {
    (mujoco as any).mj_step(model, data);
  }
};

export default function MujocoTrajectoryViewer({
  episode,
  backgroundEpisodes = [],
  selectedStep,
  onStepChange,
  fallback,
  trajectoryColor = '#ff6b35',
  getBackgroundTrajectoryColor,
}: MujocoTrajectoryViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRendererRef = useRef<MujocoSceneRenderer | null>(null);
  const modelRef = useRef<any>(null);
  const dataRef = useRef<any>(null);
  const statesRef = useRef<MujocoTrajectoryState[]>([]);
  const tcpPointsRef = useRef<THREE.Vector3[]>([]);
  // Selection playback can recreate the parent's color callback. Keep its latest
  // value without treating that render-only callback as a model lifecycle change.
  const getBackgroundTrajectoryColorRef = useRef(getBackgroundTrajectoryColor);
  getBackgroundTrajectoryColorRef.current = getBackgroundTrajectoryColor;
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [playing, setPlaying] = useState(false);
  const maxStep = useMemo(() => Math.max(0, statesRef.current.length - 1), [status]);

  useEffect(() => {
    let disposed = false;

    const initialize = async () => {
      setStatus('loading');
      setPlaying(false);
      try {
        const [mujoco, manifest, trajectory] = await Promise.all([
          getMujoco(),
          loadManifest(episode.env_name),
          loadTrajectory(episode),
        ]);
        if (disposed || !containerRef.current || trajectory.states.length === 0) {
          return;
        }

        await writeBundleFiles(mujoco, manifest);
        const model = (mujoco as any).MjModel.from_xml_path(`/metaworld/${manifest.root_xml}`);
        const data = new (mujoco as any).MjData(model);
        const tcpPoints = getTrajectoryTcpPoints(mujoco, model, data, trajectory.states);
        const selectedEpisodeKey = getEpisodeKey(episode);
        const backgroundCandidates = backgroundEpisodes
          .filter((backgroundEpisode) => getEpisodeKey(backgroundEpisode) !== selectedEpisodeKey);
        const backgroundTrajectories = await Promise.all(
          backgroundCandidates.map(async (backgroundEpisode) => {
            try {
              return await loadTrajectory(backgroundEpisode);
            } catch {
              return null;
            }
          }),
        );
        const backgroundTrajectoryPaths = backgroundTrajectories.flatMap((backgroundTrajectory, index) => {
          if (!backgroundTrajectory) {
            return [];
          }
          return [{
            points: getTrajectoryTcpPoints(mujoco, model, data, backgroundTrajectory.states),
            color: getBackgroundTrajectoryColorRef.current?.(backgroundCandidates[index]) ?? '#9aa0a6',
          }];
        });

        if (disposed) {
          data.delete();
          model.delete();
          return;
        }

        modelRef.current = model;
        dataRef.current = data;
        statesRef.current = trajectory.states;
        tcpPointsRef.current = tcpPoints;
        sceneRendererRef.current = new MujocoSceneRenderer(
          mujoco,
          model,
          data,
          containerRef.current,
          tcpPoints,
          backgroundTrajectoryPaths,
          trajectoryColor,
        );
        const initialStep = clampStep(selectedStep, trajectory.states.length - 1);
        sceneRendererRef.current.setState(trajectory.states[initialStep], tcpPoints[initialStep]);
        setStatus('ready');
      } catch (error) {
        console.warn('Falling back to video preview because the MuJoCo viewer could not initialize:', error);
        setStatus('fallback');
      }
    };

    void initialize();

    return () => {
      disposed = true;
      sceneRendererRef.current?.dispose();
      sceneRendererRef.current = null;
      dataRef.current?.delete();
      dataRef.current = null;
      modelRef.current?.delete();
      modelRef.current = null;
      statesRef.current = [];
      tcpPointsRef.current = [];
    };
  }, [
    episode.env_name,
    episode.benchmark_id,
    episode.checkpoint_step,
    episode.episode_num,
    backgroundEpisodes,
    trajectoryColor,
  ]);

  useEffect(() => {
    if (status !== 'ready' || statesRef.current.length === 0) {
      return;
    }
    const step = clampStep(selectedStep, statesRef.current.length - 1);
    sceneRendererRef.current?.setState(statesRef.current[step], tcpPointsRef.current[step]);
  }, [selectedStep, status]);

  useEffect(() => {
    if (!playing || status !== 'ready') {
      return;
    }
    const intervalId = window.setInterval(() => {
      const nextStep = selectedStep >= maxStep ? 0 : selectedStep + 1;
      onStepChange?.(nextStep);
    }, 50);
    return () => window.clearInterval(intervalId);
  }, [maxStep, onStepChange, playing, selectedStep, status]);

  if (status === 'fallback') {
    return <>{fallback}</>;
  }

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'grey.100',
      }}
    >
      <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />
      {status === 'loading' && (
        <Stack
          spacing={1}
          alignItems="center"
          justifyContent="center"
          sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.82)' }}
        >
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            Loading browser-side MuJoCo preview…
          </Typography>
        </Stack>
      )}
      {status === 'ready' && (
        <>
          <Box
            sx={{
              position: 'absolute',
              left: 10,
              top: 10,
              px: 1,
              py: 0.5,
              bgcolor: 'rgba(0,0,0,0.58)',
              color: 'common.white',
              borderRadius: 1,
              fontSize: '0.72rem',
            }}
          >
            Ready
          </Box>
          <IconButton
            size="small"
            onClick={() => setPlaying((value) => !value)}
            sx={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              bgcolor: 'rgba(0,0,0,0.58)',
              color: 'common.white',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.74)' },
            }}
          >
            {playing ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
          </IconButton>
        </>
      )}
    </Box>
  );
}

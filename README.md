# RLHF-Blender UI

Implementation for the user interface of RLHF-Blender: A Configurable Interactive Interface for Learning from Diverse Human Feedback

> [!NOTE]  
>  The following repository is part of of the RLHF-Blender project. You find the main repository (including the RLHF-Blender python package) [here](https://github.com/ymetz/rlhfblender).

## RLHF-Blender UI

### Installation

1. Clone the repository

```bash
git clone https://github.com/ymetz/rlhfblender-ui.git
```

2. Install dependencies

```bash
cd rlhfblender-ui
npm install
```

3. Start the development server

```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Usage

The RLHF-Blender UI is a React application that can be used to interact with the RLHF-Blender python package. The UI is designed to be used in a browser and can be accessed via the URL [http://localhost:3000](http://localhost:3000) after starting the development server.
Additional guides to setup advanced interface (e.g. a local join setup via docker-compose or a remote setup in Kubernetes) is provided in the [main repository](https://github.com/ymetz/rlhfblender).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

import { createContext, useContext } from "react";

interface GetterContextType {
  getThumbnailURL: (episodeId: string) => Promise<string | undefined>;
  getVideoURL: (episodeId: string) => Promise<string | undefined>;
  getRewards: (episodeId: string) => Promise<number[] | undefined>;
  getUncertainty: (episodeId: string) => Promise<number[] | undefined>;
}

const GetterContext = createContext<GetterContextType | undefined>(undefined);

const useGetter = () => {
  const context = useContext(GetterContext);
  if (!context) {
    throw new Error("useCache must be used within a CacheProvider");
  }
  return context;
};

export { GetterContext, useGetter };

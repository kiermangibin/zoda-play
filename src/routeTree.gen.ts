/* eslint-disable */

// @ts-nocheck

// This file is intentionally small for the mission-only app.

import { Route as rootRouteImport } from "./routes/__root";
import { Route as IndexRouteImport } from "./routes/index";
import { Route as MissionRouteImport } from "./routes/mission";
import { Route as MissionPlayRouteImport } from "./routes/mission_.play";

const IndexRoute = IndexRouteImport.update({
  id: "/",
  path: "/",
  getParentRoute: () => rootRouteImport,
} as any);

const MissionRoute = MissionRouteImport.update({
  id: "/mission",
  path: "/mission",
  getParentRoute: () => rootRouteImport,
} as any);

const MissionPlayRoute = MissionPlayRouteImport.update({
  id: "/mission_/play",
  path: "/mission/play",
  getParentRoute: () => rootRouteImport,
} as any);

export interface FileRoutesByFullPath {
  "/": typeof IndexRoute;
  "/mission": typeof MissionRoute;
  "/mission/play": typeof MissionPlayRoute;
}

export interface FileRoutesByTo {
  "/": typeof IndexRoute;
  "/mission": typeof MissionRoute;
  "/mission/play": typeof MissionPlayRoute;
}

export interface FileRoutesById {
  __root__: typeof rootRouteImport;
  "/": typeof IndexRoute;
  "/mission": typeof MissionRoute;
  "/mission_/play": typeof MissionPlayRoute;
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath;
  fullPaths: "/" | "/mission" | "/mission/play";
  fileRoutesByTo: FileRoutesByTo;
  to: "/" | "/mission" | "/mission/play";
  id: "__root__" | "/" | "/mission" | "/mission_/play";
  fileRoutesById: FileRoutesById;
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute;
  MissionRoute: typeof MissionRoute;
  MissionPlayRoute: typeof MissionPlayRoute;
}

declare module "@tanstack/react-router" {
  interface FileRoutesByPath {
    "/": {
      id: "/";
      path: "/";
      fullPath: "/";
      preLoaderRoute: typeof IndexRouteImport;
      parentRoute: typeof rootRouteImport;
    };
    "/mission": {
      id: "/mission";
      path: "/mission";
      fullPath: "/mission";
      preLoaderRoute: typeof MissionRouteImport;
      parentRoute: typeof rootRouteImport;
    };
    "/mission_/play": {
      id: "/mission_/play";
      path: "/mission/play";
      fullPath: "/mission/play";
      preLoaderRoute: typeof MissionPlayRouteImport;
      parentRoute: typeof rootRouteImport;
    };
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute,
  MissionRoute,
  MissionPlayRoute,
};

export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>();

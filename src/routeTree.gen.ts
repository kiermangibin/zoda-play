/* eslint-disable */

// @ts-nocheck

// This file is intentionally small for the mission-only app.

import { Route as rootRouteImport } from "./routes/__root";
import { Route as AdminMembersRouteImport } from "./routes/admin.members";
import { Route as AdminRouteImport } from "./routes/admin";
import { Route as AdminUsersRouteImport } from "./routes/admin.users";
import { Route as ForgotPasswordRouteImport } from "./routes/forgot-password";
import { Route as IndexRouteImport } from "./routes/index";
import { Route as LoginRouteImport } from "./routes/login";
import { Route as MissionRouteImport } from "./routes/mission";
import { Route as MissionBagRouteImport } from "./routes/mission.bag";
import { Route as MissionRewardsRouteImport } from "./routes/mission.rewards";
import { Route as MissionPlayRouteImport } from "./routes/mission_.play";
import { Route as ResetPasswordRouteImport } from "./routes/reset-password";

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

const LoginRoute = LoginRouteImport.update({
  id: "/login",
  path: "/login",
  getParentRoute: () => rootRouteImport,
} as any);

const ForgotPasswordRoute = ForgotPasswordRouteImport.update({
  id: "/forgot-password",
  path: "/forgot-password",
  getParentRoute: () => rootRouteImport,
} as any);

const ResetPasswordRoute = ResetPasswordRouteImport.update({
  id: "/reset-password",
  path: "/reset-password",
  getParentRoute: () => rootRouteImport,
} as any);

const AdminRoute = AdminRouteImport.update({
  id: "/admin",
  path: "/admin",
  getParentRoute: () => rootRouteImport,
} as any);

const AdminMembersRoute = AdminMembersRouteImport.update({
  id: "/admin/members",
  path: "/admin/members",
  getParentRoute: () => rootRouteImport,
} as any);

const AdminUsersRoute = AdminUsersRouteImport.update({
  id: "/admin/users",
  path: "/admin/users",
  getParentRoute: () => rootRouteImport,
} as any);

const MissionBagRoute = MissionBagRouteImport.update({
  id: "/mission/bag",
  path: "/mission/bag",
  getParentRoute: () => rootRouteImport,
} as any);

const MissionRewardsRoute = MissionRewardsRouteImport.update({
  id: "/mission/rewards",
  path: "/mission/rewards",
  getParentRoute: () => rootRouteImport,
} as any);

const MissionPlayRoute = MissionPlayRouteImport.update({
  id: "/mission_/play",
  path: "/mission/play",
  getParentRoute: () => rootRouteImport,
} as any);

export interface FileRoutesByFullPath {
  "/": typeof IndexRoute;
  "/admin": typeof AdminRoute;
  "/admin/members": typeof AdminMembersRoute;
  "/admin/users": typeof AdminUsersRoute;
  "/forgot-password": typeof ForgotPasswordRoute;
  "/login": typeof LoginRoute;
  "/mission": typeof MissionRoute;
  "/mission/bag": typeof MissionBagRoute;
  "/mission/play": typeof MissionPlayRoute;
  "/mission/rewards": typeof MissionRewardsRoute;
  "/reset-password": typeof ResetPasswordRoute;
}

export interface FileRoutesByTo {
  "/": typeof IndexRoute;
  "/admin": typeof AdminRoute;
  "/admin/members": typeof AdminMembersRoute;
  "/admin/users": typeof AdminUsersRoute;
  "/forgot-password": typeof ForgotPasswordRoute;
  "/login": typeof LoginRoute;
  "/mission": typeof MissionRoute;
  "/mission/bag": typeof MissionBagRoute;
  "/mission/play": typeof MissionPlayRoute;
  "/mission/rewards": typeof MissionRewardsRoute;
  "/reset-password": typeof ResetPasswordRoute;
}

export interface FileRoutesById {
  __root__: typeof rootRouteImport;
  "/": typeof IndexRoute;
  "/admin": typeof AdminRoute;
  "/admin/members": typeof AdminMembersRoute;
  "/admin/users": typeof AdminUsersRoute;
  "/forgot-password": typeof ForgotPasswordRoute;
  "/login": typeof LoginRoute;
  "/mission": typeof MissionRoute;
  "/mission/bag": typeof MissionBagRoute;
  "/mission/rewards": typeof MissionRewardsRoute;
  "/mission_/play": typeof MissionPlayRoute;
  "/reset-password": typeof ResetPasswordRoute;
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath;
  fullPaths:
    | "/"
    | "/admin"
    | "/admin/members"
    | "/admin/users"
    | "/forgot-password"
    | "/login"
    | "/mission"
    | "/mission/bag"
    | "/mission/play"
    | "/mission/rewards"
    | "/reset-password";
  fileRoutesByTo: FileRoutesByTo;
  to:
    | "/"
    | "/admin"
    | "/admin/members"
    | "/admin/users"
    | "/forgot-password"
    | "/login"
    | "/mission"
    | "/mission/bag"
    | "/mission/play"
    | "/mission/rewards"
    | "/reset-password";
  id:
    | "__root__"
    | "/"
    | "/admin"
    | "/admin/members"
    | "/admin/users"
    | "/forgot-password"
    | "/login"
    | "/mission"
    | "/mission/bag"
    | "/mission/rewards"
    | "/mission_/play"
    | "/reset-password";
  fileRoutesById: FileRoutesById;
}

export interface RootRouteChildren {
  AdminMembersRoute: typeof AdminMembersRoute;
  AdminRoute: typeof AdminRoute;
  AdminUsersRoute: typeof AdminUsersRoute;
  ForgotPasswordRoute: typeof ForgotPasswordRoute;
  IndexRoute: typeof IndexRoute;
  LoginRoute: typeof LoginRoute;
  MissionRoute: typeof MissionRoute;
  MissionBagRoute: typeof MissionBagRoute;
  MissionPlayRoute: typeof MissionPlayRoute;
  MissionRewardsRoute: typeof MissionRewardsRoute;
  ResetPasswordRoute: typeof ResetPasswordRoute;
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
    "/admin": {
      id: "/admin";
      path: "/admin";
      fullPath: "/admin";
      preLoaderRoute: typeof AdminRouteImport;
      parentRoute: typeof rootRouteImport;
    };
    "/admin/members": {
      id: "/admin/members";
      path: "/admin/members";
      fullPath: "/admin/members";
      preLoaderRoute: typeof AdminMembersRouteImport;
      parentRoute: typeof rootRouteImport;
    };
    "/admin/users": {
      id: "/admin/users";
      path: "/admin/users";
      fullPath: "/admin/users";
      preLoaderRoute: typeof AdminUsersRouteImport;
      parentRoute: typeof rootRouteImport;
    };
    "/forgot-password": {
      id: "/forgot-password";
      path: "/forgot-password";
      fullPath: "/forgot-password";
      preLoaderRoute: typeof ForgotPasswordRouteImport;
      parentRoute: typeof rootRouteImport;
    };
    "/reset-password": {
      id: "/reset-password";
      path: "/reset-password";
      fullPath: "/reset-password";
      preLoaderRoute: typeof ResetPasswordRouteImport;
      parentRoute: typeof rootRouteImport;
    };
    "/mission": {
      id: "/mission";
      path: "/mission";
      fullPath: "/mission";
      preLoaderRoute: typeof MissionRouteImport;
      parentRoute: typeof rootRouteImport;
    };
    "/mission/bag": {
      id: "/mission/bag";
      path: "/mission/bag";
      fullPath: "/mission/bag";
      preLoaderRoute: typeof MissionBagRouteImport;
      parentRoute: typeof rootRouteImport;
    };
    "/mission/rewards": {
      id: "/mission/rewards";
      path: "/mission/rewards";
      fullPath: "/mission/rewards";
      preLoaderRoute: typeof MissionRewardsRouteImport;
      parentRoute: typeof rootRouteImport;
    };
    "/login": {
      id: "/login";
      path: "/login";
      fullPath: "/login";
      preLoaderRoute: typeof LoginRouteImport;
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
  AdminMembersRoute,
  AdminRoute,
  AdminUsersRoute,
  ForgotPasswordRoute,
  IndexRoute,
  LoginRoute,
  MissionRoute,
  MissionBagRoute,
  MissionPlayRoute,
  MissionRewardsRoute,
  ResetPasswordRoute,
};

export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>();

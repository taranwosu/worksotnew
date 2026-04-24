import React from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";
import { createBrowserHistory } from "@tanstack/history";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { ExpertsPage } from "./pages/ExpertsPage";
import { ExpertDetailPage } from "./pages/ExpertDetailPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { PricingPage } from "./pages/PricingPage";
import { ForExpertsPage } from "./pages/ForExpertsPage";
import { ContactPage } from "./pages/ContactPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { ExpertOnboardingPage } from "./pages/ExpertOnboardingPage";
import { PostRequestPage } from "./pages/PostRequestPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MessagesPage } from "./pages/MessagesPage";
import { ProjectWorkspacePage } from "./pages/ProjectWorkspacePage";
import { ContractPage } from "./pages/ContractPage";

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const expertsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/experts",
  component: ExpertsPage,
});

const expertDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/experts/$expertId",
  component: ExpertDetailPage,
});

const howItWorksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/how-it-works",
  component: HowItWorksPage,
});

const pricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pricing",
  component: PricingPage,
});

const forExpertsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/for-experts",
  component: ForExpertsPage,
});

const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contact",
  component: ContactPage,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signin",
  component: SignInPage,
});

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: SignUpPage,
});

const expertOnboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding/expert",
  component: ExpertOnboardingPage,
});

const postRequestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/post-request",
  component: PostRequestPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage,
});

const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages",
  component: MessagesPage,
  validateSearch: (
    search: Record<string, unknown>
  ): { id?: string; proposal?: string } => {
    const out: { id?: string; proposal?: string } = {};
    if (typeof search.id === "string") out.id = search.id;
    if (typeof search.proposal === "string") out.proposal = search.proposal;
    return out;
  },
});

const projectWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace/$proposalId",
  component: ProjectWorkspacePage,
});

const contractRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contracts/$contractId",
  component: ContractPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  expertsRoute,
  expertDetailRoute,
  howItWorksRoute,
  pricingRoute,
  forExpertsRoute,
  contactRoute,
  signInRoute,
  signUpRoute,
  expertOnboardingRoute,
  postRequestRoute,
  dashboardRoute,
  messagesRoute,
  projectWorkspaceRoute,
  contractRoute,
]);

const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const App: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default App;

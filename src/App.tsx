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
import { BriefsPage } from "./pages/BriefsPage";
import { BriefDetailPage } from "./pages/BriefDetailPage";
import { ContractPage } from "./pages/ContractPage";
import { MessagesPage } from "./pages/MessagesPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminPage } from "./pages/AdminPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

const make = (path: string, component: React.FC) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

const routes = [
  make("/", HomePage),
  make("/experts", ExpertsPage),
  createRoute({ getParentRoute: () => rootRoute, path: "/experts/$expertId", component: ExpertDetailPage }),
  make("/how-it-works", HowItWorksPage),
  make("/pricing", PricingPage),
  make("/for-experts", ForExpertsPage),
  make("/contact", ContactPage),
  make("/signin", SignInPage),
  make("/signup", SignUpPage),
  make("/onboarding/expert", ExpertOnboardingPage),
  make("/post-request", PostRequestPage),
  make("/dashboard", DashboardPage),
  make("/briefs", BriefsPage),
  createRoute({ getParentRoute: () => rootRoute, path: "/briefs/$briefId", component: BriefDetailPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/contracts/$contractId", component: ContractPage }),
  make("/messages", MessagesPage),
  make("/admin/login", AdminLoginPage),
  make("/admin", AdminPage),
  make("/legal/terms", TermsPage),
  make("/legal/privacy", PrivacyPage),
];

const routeTree = rootRoute.addChildren(routes);

const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const App: React.FC = () => <RouterProvider router={router} />;
export default App;

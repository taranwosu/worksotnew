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
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { VettingPage } from "./pages/VettingPage";
import { ProcessPage } from "./pages/ProcessPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AccountSettingsPage } from "./pages/AccountSettingsPage";
import { AcceptableUsePage } from "./pages/AcceptableUsePage";
import { ClientPortalPage } from "./pages/ClientPortalPage";
import { ClientTaskDetailPage } from "./pages/ClientTaskDetailPage";
import { PoolTasksPage } from "./pages/PoolTasksPage";
import { PoolTaskDetailPage } from "./pages/PoolTaskDetailPage";
import { ManagedServicesPage } from "./pages/ManagedServicesPage";
import { ManagedTalentPage } from "./pages/ManagedTalentPage";
import { BlogPage } from "./pages/BlogPage";
import { BlogPostPage } from "./pages/BlogPostPage";

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

// Generic helper preserves the path literal so tanstack-router's type
// registry can see every route — without this the Link `to` prop only
// accepts the handful of routes defined with explicit createRoute() calls.
const make = <P extends string>(path: P, component: React.FC) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

const routes = [
  make("/", HomePage),
  make("/experts", ExpertsPage),
  createRoute({ getParentRoute: () => rootRoute, path: "/experts/$expertId", component: ExpertDetailPage }),
  make("/how-it-works", HowItWorksPage),
  make("/managed-services", ManagedServicesPage),
  make("/managed-talent", ManagedTalentPage),
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
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/messages",
    component: MessagesPage,
    validateSearch: (s: Record<string, unknown>): { c?: string } => ({
      c: typeof s.c === "string" ? s.c : undefined,
    }),
  }),
  make("/settings", AccountSettingsPage),
  make("/admin/login", AdminLoginPage),
  make("/admin", AdminPage),
  make("/legal/terms", TermsPage),
  make("/legal/privacy", PrivacyPage),
  make("/legal/acceptable-use", AcceptableUsePage),
  make("/forgot-password", ForgotPasswordPage),
  make("/reset-password", ResetPasswordPage),
  make("/vetting", VettingPage),
  make("/process", ProcessPage),
  make("/portal", ClientPortalPage),
  createRoute({ getParentRoute: () => rootRoute, path: "/portal/tasks/$taskId", component: ClientTaskDetailPage }),
  make("/pool/tasks", PoolTasksPage),
  createRoute({ getParentRoute: () => rootRoute, path: "/pool/tasks/$taskId", component: PoolTaskDetailPage }),
  make("/blog", BlogPage),
  createRoute({ getParentRoute: () => rootRoute, path: "/blog/$slug", component: BlogPostPage }),
] as const;

const routeTree = rootRoute.addChildren(routes);

const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
  defaultNotFoundComponent: NotFoundPage,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const App: React.FC = () => <RouterProvider router={router} />;
export default App;

export interface Expert {
  id: string;
  name: string;
  title: string;
  specialty: string;
  category: string;
  location: string;
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  availability: string;
  verified: boolean;
  topRated: boolean;
  image: string;
  bio: string;
  skills: string[];
  languages: string[];
  experience: string;
  completedProjects: number;
  responseTime: string;
}

export const experts: Expert[] = [
  {
    id: "elena-vasquez",
    name: "Elena Vasquez, CPA",
    title: "Senior Tax Strategist & Fractional CFO",
    specialty: "Accounting & Tax",
    category: "Accounting",
    location: "Austin, TX",
    hourlyRate: 285,
    rating: 4.98,
    reviewCount: 143,
    availability: "Available next week",
    verified: true,
    topRated: true,
    image: "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776887239370-mfz2r10v5gj-expert-elena.webp",
    bio: "15+ years structuring tax strategies for high-growth startups and mid-market firms. Former Big Four with deep expertise in SaaS revenue recognition, R&D credits, and multi-state compliance.",
    skills: ["Tax Strategy", "Fractional CFO", "R&D Credits", "Multi-state Tax", "SaaS Accounting", "GAAP"],
    languages: ["English", "Spanish"],
    experience: "15 years",
    completedProjects: 212,
    responseTime: "< 2 hours",
  },
  {
    id: "sarah-chen",
    name: "Sarah Chen",
    title: "Product Design & UX Strategy Lead",
    specialty: "Design & UX",
    category: "Design",
    location: "San Francisco, CA",
    hourlyRate: 225,
    rating: 4.97,
    reviewCount: 198,
    availability: "Available now",
    verified: true,
    topRated: true,
    image: "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776887239708-vh69ecbblhr-expert-sarah.webp",
    bio: "Product designer with a decade leading design systems at Stripe and Figma. I help Series A–C startups ship thoughtful, conversion-focused interfaces that users love.",
    skills: ["Product Design", "Design Systems", "User Research", "Figma", "Prototyping", "Accessibility"],
    languages: ["English", "Mandarin"],
    experience: "10 years",
    completedProjects: 156,
    responseTime: "< 4 hours",
  },
  {
    id: "marcus-thompson",
    name: "Marcus Thompson",
    title: "Management Consultant — Operations",
    specialty: "Strategy Consulting",
    category: "Consulting",
    location: "Chicago, IL",
    hourlyRate: 310,
    rating: 4.95,
    reviewCount: 87,
    availability: "Available in 2 weeks",
    verified: true,
    topRated: true,
    image: "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776887239769-fa61txgjdh-expert-marcus.webp",
    bio: "Ex-McKinsey operations consultant specializing in supply chain optimization and organizational design for manufacturing and logistics companies with $50M–$500M revenue.",
    skills: ["Operations", "Supply Chain", "Org Design", "Change Management", "Process Mapping", "Lean Six Sigma"],
    languages: ["English"],
    experience: "12 years",
    completedProjects: 64,
    responseTime: "< 6 hours",
  },
  {
    id: "david-okonkwo",
    name: "David Okonkwo, PE",
    title: "Structural Engineering Consultant",
    specialty: "Engineering",
    category: "Engineering",
    location: "Denver, CO",
    hourlyRate: 195,
    rating: 4.99,
    reviewCount: 112,
    availability: "Available now",
    verified: true,
    topRated: true,
    image: "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776887240731-re0lv5rkolm-expert-david.webp",
    bio: "Licensed PE in 14 states. I provide structural analysis, seismic retrofit design, and peer review for commercial and industrial projects from $500K to $50M.",
    skills: ["Structural Analysis", "Seismic Design", "Steel Design", "Concrete Design", "RISA", "Peer Review"],
    languages: ["English", "French"],
    experience: "18 years",
    completedProjects: 287,
    responseTime: "< 3 hours",
  },
  {
    id: "james-reid",
    name: "James Reid",
    title: "SOC 2 & HIPAA Compliance Specialist",
    specialty: "Compliance",
    category: "Compliance",
    location: "Boston, MA",
    hourlyRate: 240,
    rating: 4.96,
    reviewCount: 91,
    availability: "Available next week",
    verified: true,
    topRated: false,
    image: "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776887241375-ud0mmlgia3t-expert-james.webp",
    bio: "I guide B2B SaaS companies through SOC 2 Type II, HIPAA, and ISO 27001 from first gap assessment to audit. Auditor-friendly, engineer-friendly approach.",
    skills: ["SOC 2", "HIPAA", "ISO 27001", "GDPR", "Risk Assessment", "Vendor Management"],
    languages: ["English"],
    experience: "11 years",
    completedProjects: 79,
    responseTime: "< 2 hours",
  },
  {
    id: "priya-patel",
    name: "Priya Patel, PMP",
    title: "Technical Project Director",
    specialty: "Project Management",
    category: "Project Management",
    location: "Seattle, WA",
    hourlyRate: 175,
    rating: 4.94,
    reviewCount: 134,
    availability: "Available now",
    verified: true,
    topRated: true,
    image: "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776887241468-n44mvuuevph-expert-priya.webp",
    bio: "PMP and PgMP certified project director who has shipped $200M+ of cloud migrations and platform rebuilds. Specialist in distributed teams and regulated industries.",
    skills: ["Program Management", "Agile", "Scrum", "Jira", "Cloud Migration", "Stakeholder Mgmt"],
    languages: ["English", "Hindi", "Gujarati"],
    experience: "14 years",
    completedProjects: 189,
    responseTime: "< 1 hour",
  },
];

export const categories = [
  { id: "all", label: "All Experts", count: experts.length },
  { id: "Accounting", label: "Accounting & Tax", count: experts.filter((e) => e.category === "Accounting").length },
  { id: "Consulting", label: "Consulting", count: experts.filter((e) => e.category === "Consulting").length },
  { id: "Design", label: "Design & UX", count: experts.filter((e) => e.category === "Design").length },
  { id: "Engineering", label: "Engineering", count: experts.filter((e) => e.category === "Engineering").length },
  { id: "Compliance", label: "Compliance", count: experts.filter((e) => e.category === "Compliance").length },
  { id: "Project Management", label: "Project Management", count: experts.filter((e) => e.category === "Project Management").length },
];

export const heroImages = {
  compassMountain: "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776888950362-wlr1ybp8xfm-hero-compass-mountain.webp",
  trueNorth: "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776888951899-48fwj13qgyv-hero-true-north.webp",
  horizon: "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776888950792-h5lryxd7wrr-hero-horizon.webp",
};

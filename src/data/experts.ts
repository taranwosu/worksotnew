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

// Categories shown in the directory. Counts are populated at runtime from the API.
export const CATEGORY_IDS = [
  "all",
  "Accounting & Tax",
  "Consulting",
  "Design & UX",
  "Engineering",
  "Compliance",
  "Project Management",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  all: "All Experts",
  "Accounting & Tax": "Accounting & Tax",
  Consulting: "Consulting",
  "Design & UX": "Design & UX",
  Engineering: "Engineering",
  Compliance: "Compliance",
  "Project Management": "Project Management",
};

export const heroImages = {
  compassMountain:
    "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776888950362-wlr1ybp8xfm-hero-compass-mountain.webp",
  trueNorth:
    "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776888951899-48fwj13qgyv-hero-true-north.webp",
  horizon:
    "https://cdn.shipper.now/image/users/cmnxicov50009lg04mga8qdwf/1776888950792-h5lryxd7wrr-hero-horizon.webp",
};

"""Seed WorkSoy experts."""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


def _img(idx: int, gender: str) -> str:
    # randomuser.me professional portraits — deterministic per seed
    bucket = "women" if gender == "f" else "men"
    return f"https://randomuser.me/api/portraits/{bucket}/{idx % 90}.jpg"


EXPERTS = [
    # Accounting & Tax (5)
    {"name": "Elena Vasquez, CPA", "headline": "Senior Tax Strategist & Fractional CFO", "category": "Accounting & Tax",
     "specialties": ["Tax Strategy", "Fractional CFO", "R&D Credits"], "location": "Austin, TX", "hourlyRate": 285,
     "rating": 4.98, "reviewCount": 143, "availability": "Available next week", "topRated": True, "verified": True,
     "yearsExperience": 14, "languages": ["English", "Spanish"], "certifications": ["CPA", "CMA"]},
    {"name": "Marcus Tan, CPA", "headline": "SaaS Finance & Revenue Recognition Expert", "category": "Accounting & Tax",
     "specialties": ["ASC 606", "SaaS Metrics", "Audit Prep"], "location": "San Francisco, CA", "hourlyRate": 310,
     "rating": 4.95, "reviewCount": 98, "availability": "Available now", "topRated": True, "verified": True,
     "yearsExperience": 12, "languages": ["English", "Mandarin"], "certifications": ["CPA"]},
    {"name": "Priya Sharma, CA", "headline": "International Tax & Transfer Pricing", "category": "Accounting & Tax",
     "specialties": ["Transfer Pricing", "International Tax", "BEPS"], "location": "Remote", "hourlyRate": 265,
     "rating": 4.92, "reviewCount": 67, "availability": "Available in 2 weeks", "topRated": False, "verified": True,
     "yearsExperience": 10, "languages": ["English", "Hindi"], "certifications": ["CA", "CPA"]},
    {"name": "Jonathan Pierce", "headline": "Fractional CFO for Seed → Series B", "category": "Accounting & Tax",
     "specialties": ["Fundraising", "Financial Modeling", "Cap Tables"], "location": "New York, NY", "hourlyRate": 350,
     "rating": 4.97, "reviewCount": 112, "availability": "Available now", "topRated": True, "verified": True,
     "yearsExperience": 16, "languages": ["English"], "certifications": ["MBA", "CPA"]},
    {"name": "Rachel Goldstein", "headline": "Nonprofit Accounting & Grants Compliance", "category": "Accounting & Tax",
     "specialties": ["Form 990", "Grant Accounting", "A-133 Audits"], "location": "Washington, DC", "hourlyRate": 195,
     "rating": 4.90, "reviewCount": 54, "availability": "Available next week", "topRated": False, "verified": True,
     "yearsExperience": 9, "languages": ["English"], "certifications": ["CPA"]},

    # Consulting (5)
    {"name": "David Lin", "headline": "GTM Strategy for B2B SaaS", "category": "Consulting",
     "specialties": ["GTM Strategy", "Pricing", "Sales Ops"], "location": "San Francisco, CA", "hourlyRate": 320,
     "rating": 4.96, "reviewCount": 88, "availability": "Available now", "topRated": True, "verified": True,
     "yearsExperience": 13, "languages": ["English"], "certifications": ["MBA"]},
    {"name": "Amelia Brooks", "headline": "Operations & Supply Chain Consultant", "category": "Consulting",
     "specialties": ["Lean Ops", "Supply Chain", "Process Design"], "location": "Chicago, IL", "hourlyRate": 240,
     "rating": 4.88, "reviewCount": 71, "availability": "Available in 2 weeks", "topRated": False, "verified": True,
     "yearsExperience": 11, "languages": ["English"], "certifications": ["Six Sigma Black Belt"]},
    {"name": "Kwame Osei", "headline": "Ex-McKinsey · Growth & Strategy", "category": "Consulting",
     "specialties": ["Growth Strategy", "Market Entry", "M&A Diligence"], "location": "London, UK", "hourlyRate": 380,
     "rating": 4.99, "reviewCount": 121, "availability": "Available next week", "topRated": True, "verified": True,
     "yearsExperience": 15, "languages": ["English", "French"], "certifications": ["MBA"]},
    {"name": "Sofia Rizzi", "headline": "Brand Strategy & Positioning", "category": "Consulting",
     "specialties": ["Brand Strategy", "Positioning", "Messaging"], "location": "Milan, IT", "hourlyRate": 220,
     "rating": 4.91, "reviewCount": 62, "availability": "Available now", "topRated": False, "verified": True,
     "yearsExperience": 10, "languages": ["English", "Italian"], "certifications": ["MBA"]},

    # Design & UX (5)
    {"name": "Sarah Chen", "headline": "Product Design & UX Strategy Lead", "category": "Design & UX",
     "specialties": ["Product Design", "Design Systems", "User Research"], "location": "San Francisco, CA",
     "hourlyRate": 225, "rating": 4.97, "reviewCount": 198, "availability": "Available now", "topRated": True,
     "verified": True, "yearsExperience": 11, "languages": ["English", "Mandarin"],
     "certifications": ["Nielsen Norman UX"]},
    {"name": "Arjun Mehta", "headline": "Senior Product Designer · Fintech", "category": "Design & UX",
     "specialties": ["Fintech UX", "Mobile Design", "Prototyping"], "location": "Bangalore, IN", "hourlyRate": 135,
     "rating": 4.94, "reviewCount": 87, "availability": "Available now", "topRated": False, "verified": True,
     "yearsExperience": 8, "languages": ["English", "Hindi"], "certifications": []},
    {"name": "Isabelle Moreau", "headline": "Brand & Visual Identity Designer", "category": "Design & UX",
     "specialties": ["Brand Identity", "Typography", "Packaging"], "location": "Paris, FR", "hourlyRate": 175,
     "rating": 4.93, "reviewCount": 76, "availability": "Available next week", "topRated": False, "verified": True,
     "yearsExperience": 12, "languages": ["English", "French"], "certifications": []},
    {"name": "Trevor Hughes", "headline": "UX Researcher · Mixed Methods", "category": "Design & UX",
     "specialties": ["Qualitative Research", "Usability Testing", "Jobs-To-Be-Done"], "location": "Toronto, CA",
     "hourlyRate": 165, "rating": 4.89, "reviewCount": 58, "availability": "Available in 2 weeks", "topRated": False,
     "verified": True, "yearsExperience": 9, "languages": ["English"], "certifications": ["NN/g UX"]},
    {"name": "Yuki Tanaka", "headline": "Motion & Interaction Designer", "category": "Design & UX",
     "specialties": ["Motion Design", "Figma Prototyping", "Micro-interactions"], "location": "Tokyo, JP",
     "hourlyRate": 155, "rating": 4.92, "reviewCount": 49, "availability": "Available now", "topRated": False,
     "verified": True, "yearsExperience": 7, "languages": ["English", "Japanese"], "certifications": []},

    # Engineering (5)
    {"name": "David Okonkwo, PE", "headline": "Structural Engineering Consultant", "category": "Engineering",
     "specialties": ["Structural Analysis", "Seismic Design", "Steel Design"], "location": "Denver, CO",
     "hourlyRate": 195, "rating": 4.99, "reviewCount": 112, "availability": "Available now", "topRated": True,
     "verified": True, "yearsExperience": 15, "languages": ["English"], "certifications": ["PE", "SE"]},
    {"name": "Ana Ferreira", "headline": "Senior Software Architect · Distributed Systems", "category": "Engineering",
     "specialties": ["Distributed Systems", "Kafka", "Cloud Architecture"], "location": "Lisbon, PT",
     "hourlyRate": 260, "rating": 4.96, "reviewCount": 104, "availability": "Available next week", "topRated": True,
     "verified": True, "yearsExperience": 13, "languages": ["English", "Portuguese"],
     "certifications": ["AWS Solutions Architect Pro"]},
    {"name": "Michael Novak", "headline": "Embedded Systems & Firmware Engineer", "category": "Engineering",
     "specialties": ["Embedded C", "RTOS", "Hardware Bring-Up"], "location": "Prague, CZ", "hourlyRate": 175,
     "rating": 4.90, "reviewCount": 61, "availability": "Available in 2 weeks", "topRated": False, "verified": True,
     "yearsExperience": 12, "languages": ["English", "Czech"], "certifications": []},
    {"name": "Leah Abramson", "headline": "ML Engineer · NLP & Recommendation Systems", "category": "Engineering",
     "specialties": ["LLM Ops", "Retrieval", "Model Evaluation"], "location": "Tel Aviv, IL", "hourlyRate": 285,
     "rating": 4.97, "reviewCount": 93, "availability": "Available now", "topRated": True, "verified": True,
     "yearsExperience": 10, "languages": ["English", "Hebrew"], "certifications": []},
    {"name": "Carlos Mendoza, PE", "headline": "Mechanical Engineering · HVAC & Energy", "category": "Engineering",
     "specialties": ["HVAC Design", "Energy Modeling", "LEED"], "location": "Mexico City, MX", "hourlyRate": 165,
     "rating": 4.88, "reviewCount": 55, "availability": "Available next week", "topRated": False, "verified": True,
     "yearsExperience": 11, "languages": ["English", "Spanish"], "certifications": ["PE", "LEED AP"]},

    # Compliance (3)
    {"name": "Nadia Hassan", "headline": "SOC 2 & ISO 27001 Lead Auditor", "category": "Compliance",
     "specialties": ["SOC 2", "ISO 27001", "Risk Assessments"], "location": "Dubai, AE", "hourlyRate": 245,
     "rating": 4.95, "reviewCount": 82, "availability": "Available now", "topRated": True, "verified": True,
     "yearsExperience": 11, "languages": ["English", "Arabic"], "certifications": ["CISA", "ISO 27001 LA"]},
    {"name": "Benjamin Cole", "headline": "HIPAA & Healthcare Privacy Specialist", "category": "Compliance",
     "specialties": ["HIPAA", "HITRUST", "BAA Review"], "location": "Boston, MA", "hourlyRate": 215,
     "rating": 4.91, "reviewCount": 59, "availability": "Available next week", "topRated": False, "verified": True,
     "yearsExperience": 9, "languages": ["English"], "certifications": ["CIPP/US", "CHPC"]},
    {"name": "Hannah Reid", "headline": "GDPR & Data Protection Officer (fractional)", "category": "Compliance",
     "specialties": ["GDPR", "DPIA", "Cross-border Transfers"], "location": "Dublin, IE", "hourlyRate": 205,
     "rating": 4.89, "reviewCount": 47, "availability": "Available now", "topRated": False, "verified": True,
     "yearsExperience": 8, "languages": ["English"], "certifications": ["CIPP/E"]},

    # Project Management (3)
    {"name": "Ravi Patel, PMP", "headline": "Program Lead · Enterprise Rollouts", "category": "Project Management",
     "specialties": ["Program Management", "Agile Transformation", "Stakeholder Mgmt"],
     "location": "Atlanta, GA", "hourlyRate": 185, "rating": 4.93, "reviewCount": 74,
     "availability": "Available now", "topRated": True, "verified": True, "yearsExperience": 13,
     "languages": ["English", "Hindi"], "certifications": ["PMP", "SAFe 6.0"]},
    {"name": "Emma Sinclair", "headline": "Scrum Master & Delivery Coach", "category": "Project Management",
     "specialties": ["Scrum", "Kanban", "Team Coaching"], "location": "Edinburgh, UK", "hourlyRate": 155,
     "rating": 4.88, "reviewCount": 52, "availability": "Available next week", "topRated": False, "verified": True,
     "yearsExperience": 9, "languages": ["English"], "certifications": ["CSM", "CSPO"]},
    {"name": "Diego Alvarez, PMP", "headline": "Construction Project Manager", "category": "Project Management",
     "specialties": ["Construction PM", "Scheduling", "Cost Control"], "location": "Miami, FL", "hourlyRate": 175,
     "rating": 4.90, "reviewCount": 48, "availability": "Available in 2 weeks", "topRated": False, "verified": True,
     "yearsExperience": 14, "languages": ["English", "Spanish"], "certifications": ["PMP", "CCM"]},
]


async def main():
    await db.experts.delete_many({})
    # Heuristic gender per name — just for deterministic portrait selection
    female_hints = {"Elena", "Priya", "Rachel", "Amelia", "Sofia", "Sarah", "Isabelle", "Yuki", "Ana", "Leah", "Nadia", "Hannah", "Emma"}
    docs = []
    now = datetime.now(timezone.utc)
    for i, e in enumerate(EXPERTS):
        eid = f"exp_{uuid.uuid4().hex[:10]}"
        first = e["name"].split()[0]
        gender = "f" if first in female_hints else "m"
        bio = (
            f"{e['name'].split(',')[0]} is a senior {e['category'].lower()} practitioner with "
            f"{e['yearsExperience']} years of experience helping teams ship excellent work. "
            f"Core focus areas include {', '.join(e['specialties']).lower()}."
        )
        docs.append({
            **e,
            "id": eid,
            "currency": "USD",
            "image": _img(i * 7 + 3, gender),
            "bio": bio,
            "isPublished": True,
            "created_at": now,
        })
    await db.experts.insert_many(docs)
    print(f"Seeded {len(docs)} experts.")


if __name__ == "__main__":
    asyncio.run(main())

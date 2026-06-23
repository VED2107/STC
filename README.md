# STC - Smart Teaching Companion

> An intelligent educational platform designed to empower CBSE and GSEB board students with personalized learning pathways, expert mentorship, and comprehensive exam preparation.

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)

## 📚 Overview

STC is a cutting-edge educational platform built to support students across:
- **Primary to HSC** coursework (CBSE & GSEB boards)
- **Competitive Exams** (JEE Advanced, JEE Main, NEET)

### Key Features

✨ **Dual-Pathway Course System**
- Board-aligned structured curriculum
- Competitive exam preparation tracks
- Seamless progression from fundamentals to advanced topics

👨‍🏫 **Faculty Mentorship Profiles**
- Expert instructor directories
- Personalized guidance and doubt-clearing sessions
- Performance tracking and feedback

👥 **Small-Batch Enrollment**
- Limited class sizes for quality education
- Focused attention and interactive learning
- Community-driven peer learning

🔍 **Advanced Course Filtering**
- Filter by academic level, subject, and learning pathway
- Smart recommendations based on progress
- Easy navigation for students and parents

⚡ **Scalable Architecture**
- Cloud-based infrastructure (Supabase)
- Optimized frontend performance (Next.js)
- Real-time data synchronization

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend Framework** | Next.js 13+ |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Backend & Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth |
| **Real-time Features** | Supabase Realtime |
| **Storage** | Supabase Storage |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/VED2107/STC.git
cd STC

# Install dependencies
npm install

# Create environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Development

```bash
# Run development server
npm run dev

# Open browser to http://localhost:3000
```

### Production Build

```bash
# Create optimized build
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
STC/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Reusable React components
│   ├── lib/              # Utility functions and helpers
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript type definitions
│   └── styles/           # Global styles
├── public/               # Static assets
├── prisma/               # Database schema (if using Prisma)
├── supabase/             # Database migrations and functions
└── tests/                # Test files
```

## 🎯 Core Features

### For Students
- Personalized learning dashboard
- Progress tracking and performance analytics
- Interactive doubt-clearing with faculty
- Downloadable resources and notes
- Exam preparation modules (JEE/NEET)

### For Faculty
- Class management and scheduling
- Student progress monitoring
- Content creation and delivery tools
- Assignment and assessment management
- Real-time communication with students

### For Administrators
- User and role management
- Course creation and curation
- Analytics and reporting
- System configuration
- Batch and enrollment management

## 📊 Database Schema

Key entities:
- **Users** - Students, Faculty, Admins
- **Courses** - Subject-specific learning modules
- **Batches** - Small-group enrollments
- **Mentorship Sessions** - One-on-one guidance
- **Progress Tracking** - Student performance metrics
- **Resources** - Study materials and notes

## 🔐 Security & Privacy

- Supabase Row Level Security (RLS) policies
- Encrypted data transmission (HTTPS)
- Secure authentication with JWT tokens
- GDPR-compliant data handling
- Regular security audits

## 🤝 Contributing

This is a personal project developed as a complete platform. For inquiries about collaboration or contributions, please contact the developer.

## 📱 Contact & Support

**Developer:** Ved Chauhan  
**Role:** Sole Developer, System Architect & Full Stack Engineer

**Email:** [VEDCHAUHAN2107@GMAIL.COM](mailto:VEDCHAUHAN2107@GMAIL.COM)  
**Phone:** [7228000812](tel:7228000812)

---

## 📄 License

This project is proprietary and confidential. All rights reserved © 2024 Ved Chauhan.

## 🙏 Acknowledgments

Built with ❤️ for students striving for excellence across CBSE, GSEB, JEE, and NEET examinations.

---

**Version:** 1.0.0  
**Last Updated:** June 2024


import React from 'react';
import { Shield, Brain, Users, GraduationCap, Building2, Layout, UserCircle, Briefcase, CreditCard, BookOpen } from 'lucide-react';

export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Portal Home', icon: <Layout className="w-5 h-5" /> },
  { id: 'my-courses', label: 'My Courses', icon: <BookOpen className="w-5 h-5" /> },
  { id: 'providers', label: 'Providers Market', icon: <Briefcase className="w-5 h-5" /> },
  { id: 'ai-consult', label: 'Ethical AI', icon: <Brain className="w-5 h-5" /> },
  { id: 'profile', label: 'My Conscious Identity', icon: <UserCircle className="w-5 h-5" /> },
  { id: 'membership', label: 'Memberships', icon: <CreditCard className="w-5 h-5" /> },
];

export const CORE_COMPONENTS = [
  {
    title: "Ethical AI & Blockchain",
    description: "Zero-Trust architecture protecting identity and ensuring manipulation-free discovery.",
    icon: <Shield className="w-8 h-8 text-blue-400" />
  },
  {
    title: "Provider-Centric model",
    description: "Providers are the product. Full control over profile, offerings, and direct revenue.",
    icon: <Briefcase className="w-8 h-8 text-teal-400" />
  },
  {
    title: "Tiered Ecosystem",
    description: "Structured learning pathways for mental, spiritual, and professional growth.",
    icon: <GraduationCap className="w-8 h-8 text-indigo-400" />
  },
  {
    title: "Institutional Bridge",
    description: "Scalable solutions for corporations and NGOs with secure digital identity.",
    icon: <Building2 className="w-8 h-8 text-cyan-400" />
  }
];

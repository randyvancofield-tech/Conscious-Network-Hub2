
import React from 'react';
import { Shield, Brain, Users, GraduationCap, Building2, Layout, UserCircle, Briefcase, CreditCard, BookOpen, Sparkles, MessageSquareShare, Video } from 'lucide-react';

export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Portal Home', icon: <Layout className="w-5 h-5" /> },
  { id: 'social-learning', label: 'Social Learning', icon: <MessageSquareShare className="w-5 h-5" /> },
  { id: 'meetings', label: 'Conscious Meetings', icon: <Video className="w-5 h-5" /> },
  { id: 'my-courses', label: 'My Courses', icon: <BookOpen className="w-5 h-5" /> },
  { id: 'providers', label: 'Providers Market', icon: <Briefcase className="w-5 h-5" /> },
  { id: 'ai-consult', label: 'Wisdom Node', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'profile', label: 'My Conscious Identity', icon: <UserCircle className="w-5 h-5" /> },
  { id: 'membership', label: 'Memberships', icon: <CreditCard className="w-5 h-5" /> },
];

export const CORE_COMPONENTS = [
  {
    title: "Wisdom Node AI",
    description: "Multimodal intelligence for reasoning, searching, mapping, and creating visualizations.",
    icon: <Brain className="w-8 h-8 text-blue-400" />
  },
  {
    title: "Blockchain Integrity",
    description: "Zero-Trust architecture protecting identity and ensuring manipulation-free discovery.",
    icon: <Shield className="w-8 h-8 text-teal-400" />
  },
  {
    title: "Sovereign Learning",
    description: "Tiered learning pathways for mental, spiritual, and professional growth.",
    icon: <GraduationCap className="w-8 h-8 text-indigo-400" />
  },
  {
    title: "Direct Economy",
    description: "Providers are the product. Full control over profile, offerings, and direct revenue.",
    icon: <Building2 className="w-8 h-8 text-cyan-400" />
  }
];

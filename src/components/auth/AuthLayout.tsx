import React from 'react';
import { Refrigerator } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center px-4 overflow-hidden bg-slate-50">
      {/* Background Soft iOS Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[120px]" />

      <div className="w-full max-w-md z-10">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white border border-slate-200/80 text-indigo-600 mb-4 shadow-sm">
            <Refrigerator className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            GrocyWeb
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {subtitle}
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-xl shadow-slate-200/50 p-8 sm:p-10">
          <h2 className="text-xl font-extrabold text-slate-800 mb-6 text-center">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
};

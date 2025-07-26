import { AuthenticatedLayoutClient } from '@/components/auth/AuthenticatedLayoutClient';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayoutClient>{children}</AuthenticatedLayoutClient>;
}
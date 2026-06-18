import { PortalLayout } from '@/components/shared/PortalLayout'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PortalLayout>{children}</PortalLayout>
}

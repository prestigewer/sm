import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { PublicOnly, RequireAdmin, RequireAuth } from '@/components/Guards'
import { Skeleton } from '@/components/ui'

const Login = lazy(() => import('@/pages/auth/Login'))
const Register = lazy(() => import('@/pages/auth/Register'))
const Forgot = lazy(() => import('@/pages/auth/Forgot'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))

const Dashboard = lazy(() => import('@/pages/customer/Dashboard'))
const Services = lazy(() => import('@/pages/customer/Services'))
const NewOrder = lazy(() => import('@/pages/customer/NewOrder'))
const Orders = lazy(() => import('@/pages/customer/Orders'))
const OrderDetail = lazy(() => import('@/pages/customer/OrderDetail'))
const AddFunds = lazy(() => import('@/pages/customer/AddFunds'))
const Transactions = lazy(() => import('@/pages/customer/Transactions'))
const Support = lazy(() => import('@/pages/customer/Support'))
const TicketView = lazy(() => import('@/pages/shared/TicketView'))
const Profile = lazy(() => import('@/pages/customer/Profile'))

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'))
const AdminOrderDetail = lazy(() => import('@/pages/admin/AdminOrderDetail'))
const AdminRecharges = lazy(() => import('@/pages/admin/AdminRecharges'))
const AdminCustomers = lazy(() => import('@/pages/admin/AdminCustomers'))
const AdminCustomerDetail = lazy(() => import('@/pages/admin/AdminCustomerDetail'))
const AdminServices = lazy(() => import('@/pages/admin/AdminServices'))
const AdminTickets = lazy(() => import('@/pages/admin/AdminTickets'))
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'))
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))

const Fallback = () => <div className="space-y-3 p-8"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<Forgot />} />
        </Route>
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/services" element={<Services />} />
            <Route path="/new-order" element={<NewOrder />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/add-funds" element={<AddFunds />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/support" element={<Support />} />
            <Route path="/support/:id" element={<TicketView />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route element={<RequireAdmin />}>
            <Route element={<Layout admin />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
              <Route path="/admin/recharges" element={<AdminRecharges />} />
              <Route path="/admin/customers" element={<AdminCustomers />} />
              <Route path="/admin/customers/:id" element={<AdminCustomerDetail />} />
              <Route path="/admin/services" element={<AdminServices />} />
              <Route path="/admin/tickets" element={<AdminTickets />} />
              <Route path="/admin/tickets/:id" element={<TicketView admin />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

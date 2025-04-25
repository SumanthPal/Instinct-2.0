// src/pages/auth/confirm.js

import Link from 'next/link'

export default function ConfirmSignUp() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Check your email
          </h2>
        </div>
        
        <div className="mt-2">
          <p className="text-sm text-gray-600">
            We've sent you a confirmation email. Please click the link in that email to verify your account.
          </p>
        </div>
        
        <div className="mt-5">
          <p className="text-sm">
            Already confirmed?{' '}
            <Link href="/auth/login" className="text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
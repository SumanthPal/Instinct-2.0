import Link from 'next/link';
import { useAuth } from '@/context/auth-context'; // Assuming you already have this

export default function CategoryFooter() {
  const { user } = useAuth(); // get current logged in user

  if (!user) return null; // ❌ Don't show anything if not signed in

  return (
    <div className="mt-3 text-center text-base font-medium text-gray-700 dark:text-gray-300">
      <p>
        Can't find a club?{' '}
        <Link
          href="/club/add"
          className="relative inline-block text-blue-600 dark:text-blue-400 hover:underline animate-pulse-slow"
        >
          Add it here
        </Link>
      </p>
    </div>
  );
}
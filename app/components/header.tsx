'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { useAuth } from '../hooks/useAuth';

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 py-3 grid grid-cols-3 items-center">
        {/* Navegación a la izquierda */}
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              isActive('/') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            Home
          </Link>
          <Link
            href="/plan-generator"
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              isActive('/plan-generator') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            Plan Generator
          </Link>
          <Link
            href="/trajectory-generator"
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              isActive('/trajectory-generator') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            Trajectory Generator
          </Link>
        </div>

        {/* Logo centrado */}
        <div className="flex justify-center">
          <Image src="/images/logo.jpg" alt="UAS PLANNER Logo" width={150} height={50} />
        </div>

        {/* Botones de usuario a la derecha */}
        <div className="flex justify-end items-center space-x-4">
          {user ? (
            <>
              <div className="flex items-center space-x-2">
                <Image src="/images/pfp.jpg" alt="User Profile" width={32} height={32} className="rounded-full" />
                <span className="text-gray-300">{user.username}</span>
              </div>
              <Button onClick={logout} variant="outline" size="sm">
                Cerrar sesión
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant="outline" size="sm">
                Iniciar sesión
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

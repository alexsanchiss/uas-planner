"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./ui/button";
import { useAuth } from "../hooks/useAuth";

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 py-3 grid grid-cols-3 items-center">
        {/* Navegación a la izquierda */}
        <div className="flex items-center space-x-4">
          <Link href="/plan-generator" className="group">
            <div
              className={`px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer shadow-sm
                ${
                  isActive("/plan-generator")
                    ? "bg-blue-700 border-blue-800 text-white shadow-lg"
                    : "bg-gray-700/60 border-gray-600 text-gray-200 group-hover:bg-blue-800 group-hover:text-white group-hover:shadow-lg"
                }
                hover:scale-105 hover:shadow-xl`}
            >
              Plan Generator
            </div>
          </Link>
          <Link href="/trajectory-generator" className="group">
            <div
              className={`px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer shadow-sm
                ${
                  isActive("/trajectory-generator")
                    ? "bg-blue-700 border-blue-800 text-white shadow-lg"
                    : "bg-gray-700/60 border-gray-600 text-gray-200 group-hover:bg-blue-800 group-hover:text-white group-hover:shadow-lg"
                }
                hover:scale-105 hover:shadow-xl`}
            >
              Trajectory Generator
            </div>
          </Link>
                    <Link href="/plan-activation" className="group">
            <div
              className={`px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer shadow-sm
                ${
                  isActive("/plan-activation")
                    ? "bg-blue-700 border-blue-800 text-white shadow-lg"
                    : "bg-gray-700/60 border-gray-600 text-gray-200 group-hover:bg-blue-800 group-hover:text-white group-hover:shadow-lg"
                }
                hover:scale-105 hover:shadow-xl`}
            >
              Plan Activation
            </div>
            </Link>
        </div>
        {/* Logo centrado */}
        <div className="flex justify-center">
          <Link href="/">
            <Image
              src="/images/logo.jpg"
              alt="UAS PLANNER Logo"
              width={150}
              height={50}
            />
          </Link>
        </div>
        {/* Botones de usuario a la derecha */}
        <div className="flex justify-end items-center space-x-4">
          {user ? (
            <>
              <div className="flex items-center space-x-2">
                <Image
                  src="/images/pfp.jpg"
                  alt="User Profile"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
                <span className="text-gray-300">{user.username}</span>
              </div>
              <Button onClick={logout} variant="outline">
                Log out
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant="outline">Log in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

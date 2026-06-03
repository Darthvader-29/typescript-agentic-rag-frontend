"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Trash2, FileText, KeyRound } from "lucide-react";
import { flags } from "@/lib/flags";
import { UserMenu } from "@/features/auth/components/user-menu";

interface SidebarProps {
  onClearSession: () => void;
  onToggle?: () => void;
}

export function Sidebar({ onClearSession, onToggle }: SidebarProps) {
  return (
    <div className="bg-sidebar border-sidebar-border text-sidebar-foreground flex h-full w-64 flex-col border-r p-4">
      <div className="mb-8 flex items-center justify-between px-2">
        <div className="flex items-center gap-2 text-lg font-bold">
          <div className="bg-primary text-primary-foreground rounded p-1">
            <FileText className="h-4 w-4" />
          </div>
          RAG Chat
        </div>
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggle}
            aria-label="Toggle sidebar"
          >
            <span className="sr-only">Toggle sidebar</span>
            <svg
              viewBox="0 0 16 16"
              className="text-muted-foreground h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M10.5 3.5L6 8l4.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto">
        <div className="flex w-full flex-col items-center space-y-4">
          <div className="bg-card w-full max-w-[210px] rounded-lg border p-3 shadow-sm">
            <p className="text-muted-foreground mb-2 text-center text-xs font-semibold tracking-wider uppercase">
              Source Code
            </p>

            <div className="space-y-2">
              <a
                href="https://github.com/Darthvader-29/typescript-agentic-rag-frontend"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="w-full justify-center text-xs"
                >
                  Frontend
                </Button>
              </a>

              <a
                href="https://github.com/Darthvader-29/Python-Agentic-RAG-Backend"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="w-full justify-center text-xs"
                >
                  Backend
                </Button>
              </a>
            </div>
          </div>

          <div className="w-full px-2">
            <p className="text-muted-foreground mt-2 text-center text-xs leading-relaxed">
              Hello this is my RAG chatbot. This web application has been
              deployed using free available resources so the performance might
              not be at par with enterprise benchmarks. If encountered any
              issues please contact me via mail at{" "}
              <a
                href="mailto:Kanawadeatharva29@gmail.com"
                className="underline underline-offset-2"
              >
                Kanawadeatharva29@gmail.com
              </a>
              . Thank you.
            </p>
          </div>
        </div>
      </div>

      {/* Auth identity / guest-upgrade CTA — flag-gated; nothing renders when auth is off. */}
      {flags.auth && <UserMenu />}

      <div className="border-border flex flex-col gap-2 border-t pt-4">
        <div className="flex justify-end px-1">
          <ThemeToggle />
        </div>
        {/* BYOK key management — flag-gated; the settings screen owns auth gating. */}
        {flags.byok && (
          <Button
            asChild
            variant="ghost"
            className="w-full justify-center gap-2"
          >
            <Link href="/settings">
              <KeyRound className="h-4 w-4" />
              API Keys
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full justify-center gap-2"
          onClick={onClearSession}
        >
          <Trash2 className="h-4 w-4" />
          Reset Session
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { Moon, Sun, Rocket } from "lucide-react";
import { useEffect, useState } from "react";

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const teams = useQuery(api.teams.list);
  const agents = useQuery(api.agents.list);
  const tasks = useQuery(api.tasks.list);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Mission Control v2</h1>
              <p className="text-muted-foreground">Next.js 16 + Convex + shadcn/ui</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            disabled={!mounted}
          >
            {mounted ? (
              theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
            ) : (
              <div className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Teams</CardTitle>
              <CardDescription>Connected to Convex</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-primary">
                {teams === undefined ? "..." : teams.length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agents</CardTitle>
              <CardDescription>Fleet roster</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-primary">
                {agents === undefined ? "..." : agents.length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Missions</CardTitle>
              <CardDescription>Active tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-primary">
                {tasks === undefined ? "..." : tasks.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Setup Status */}
        <Card>
          <CardHeader>
            <CardTitle>✅ Foundation Setup Complete</CardTitle>
            <CardDescription>All core systems initialized</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Next.js 16 with App Router</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Tailwind CSS v4</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>shadcn/ui Components</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Convex Backend ({teams === undefined ? "connecting..." : "connected"})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Dark/Light Theme System</span>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>🚀 Next: Phase 2 - Core Components</CardTitle>
            <CardDescription>Build the dashboard layout and command center</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Dashboard layout with sidebar</li>
              <li>• Command Center 3-pane view</li>
              <li>• Fleet Roster component</li>
              <li>• Mission Board (Kanban + Table)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


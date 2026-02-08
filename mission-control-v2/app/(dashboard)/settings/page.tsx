"use client";

import { PolicySettings } from "@/components/dashboard/policy-settings";
import {
    Settings,
    Shield,
    Bell,
    Lock,
    Users,
    Cloud,
    Database
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
    return (
        <div className="flex-1 overflow-y-auto bg-transparent p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-primary">
                        <Settings className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-widest opacity-70">Control Panel</span>
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight">System Configuration</h1>
                    <p className="text-muted-foreground text-lg">
                        Fine-tune your fleet's behavior, security protocols, and operational boundaries.
                    </p>
                </div>

                <Tabs defaultValue="autonomy" className="w-full">
                    <div className="border-b mb-8">
                        <TabsList className="bg-transparent h-12 w-full justify-start gap-8 rounded-none border-b-0 p-0">
                            <TabsTrigger
                                value="autonomy"
                                className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-2 pb-3 pt-2 font-semibold text-muted-foreground transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >
                                <Shield className="w-4 h-4 mr-2" />
                                Autonomy & Policy
                            </TabsTrigger>
                            <TabsTrigger
                                value="security"
                                className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-2 pb-3 pt-2 font-semibold text-muted-foreground transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >
                                <Lock className="w-4 h-4 mr-2" />
                                Cloud Vault
                            </TabsTrigger>
                            <TabsTrigger
                                value="fleet"
                                className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-2 pb-3 pt-2 font-semibold text-muted-foreground transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >
                                <Users className="w-4 h-4 mr-2" />
                                Fleet Sync
                            </TabsTrigger>
                            <TabsTrigger
                                value="infrastructure"
                                className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-2 pb-3 pt-2 font-semibold text-muted-foreground transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >
                                <Cloud className="w-4 h-4 mr-2" />
                                Fly.io Orchestration
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="autonomy" className="mt-0 space-y-8 animate-in fade-in-50 duration-500">
                        {/* Policy Switchboard component */}
                        <PolicySettings />
                    </TabsContent>

                    <TabsContent value="security" className="mt-0">
                        <Card className="border-dashed">
                            <CardHeader>
                                <CardTitle>Secure Secrets Storage</CardTitle>
                                <CardDescription>Manage your organization's API keys and environment secrets.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground italic">
                                Visit the 'Cloud Vault' page for detailed secret management.
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="fleet" className="mt-0">
                        <Card className="border-dashed">
                            <CardHeader>
                                <CardTitle>Fleet Synchronization</CardTitle>
                                <CardDescription>Configure how your agents synchronize across different environments.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground italic">
                                Multi-runner synchronization settings coming soon.
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="infrastructure" className="mt-0">
                        <Card className="border-dashed">
                            <CardHeader>
                                <CardTitle>Infrastructure Management</CardTitle>
                                <CardDescription>Monitor and control Fly.io machine lifecycles.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground italic">
                                Fly.io dashboard integration in progress.
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import {
    Shield,
    Zap,
    Lock,
    AlertCircle,
    Save,
    DollarSign,
    BarChart3,
    Plus,
    Trash2,
    Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export function PolicySettings() {
    const policies = useQuery(api.policies.list) || [];
    const setPolicy = useMutation(api.policies.setPolicy);
    const teams = useQuery(api.teams.list) || [];

    const [isSaving, setIsSaving] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    const actionTypes = ["read_logs", "exec_command", "web_research", "restart_server", "send_email", "*"];

    const [newPolicy, setNewPolicy] = useState({
        actionType: "read_logs",
        teamId: undefined as string | undefined,
        policy: "manual" as const,
        maxCost: 0.1,
        minConfidence: 0.9
    });

    const handleUpdatePolicy = async (policy: any) => {
        setIsSaving(true);
        try {
            await setPolicy({
                teamId: policy.teamId,
                actionType: policy.actionType,
                policy: policy.policy,
                maxCost: policy.maxCost,
                minConfidence: policy.minConfidence,
            });
            toast.success("Policy Updated", {
                description: `Rules for ${policy.actionType === "*" ? "Global" : policy.actionType} have been saved.`
            });
        } catch (err) {
            toast.error("Failed to update policy");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddPolicy = async () => {
        setIsSaving(true);
        try {
            await setPolicy({
                ...newPolicy,
                teamId: newPolicy.teamId as Id<"teams"> | undefined
            });
            toast.success("Policy Created");
            setShowAddForm(false);
        } catch (err) {
            toast.error("Failed to create policy");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Policy Switchboard</h2>
                    <p className="text-muted-foreground">Manage the autonomy boundaries and safety gates for your fleet.</p>
                </div>
                <Badge variant="outline" className="px-3 py-1 bg-primary/10 text-primary border-primary/20">
                    <Shield className="w-3.5 h-3.5 mr-2" />
                    Gatekeeper Active
                </Badge>
            </div>

            <Tabs defaultValue="matrix" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="matrix">Auto-Approve Matrix</TabsTrigger>
                    <TabsTrigger value="thresholds">Safety Thresholds</TabsTrigger>
                </TabsList>

                {/* --- AUTO-APPROVE MATRIX --- */}
                <TabsContent value="matrix" className="pt-6">
                    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Action Access Control</CardTitle>
                                <CardDescription>Define which actions require Human-in-the-loop (HITL) approval.</CardDescription>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowAddForm(!showAddForm)}
                            >
                                {showAddForm ? "Cancel" : "Add Rule"}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {showAddForm && (
                                <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-wrap gap-4 items-end animate-in slide-in-from-top-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Action</label>
                                        <Select value={newPolicy.actionType} onValueChange={(v) => setNewPolicy({ ...newPolicy, actionType: v })}>
                                            <SelectTrigger className="w-[180px] h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {actionTypes.map(t => <SelectItem key={t} value={t}>{t === "*" ? "GLOBAL (*)" : t}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Team</label>
                                        <Select value={newPolicy.teamId || "global"} onValueChange={(v) => setNewPolicy({ ...newPolicy, teamId: v === "global" ? undefined : v })}>
                                            <SelectTrigger className="w-[180px] h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="global">Global Org</SelectItem>
                                                {teams.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Policy</label>
                                        <Select value={newPolicy.policy} onValueChange={(v: any) => setNewPolicy({ ...newPolicy, policy: v })}>
                                            <SelectTrigger className="w-[140px] h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto">Auto-Approve</SelectItem>
                                                <SelectItem value="propose_only">Propose Only</SelectItem>
                                                <SelectItem value="manual">Manual HITL</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button size="sm" onClick={handleAddPolicy} disabled={isSaving}>
                                        <Save className="w-3.5 h-3.5 mr-2" />
                                        Save Rule
                                    </Button>
                                </div>
                            )}

                            <div className="rounded-xl border border-border/50 overflow-hidden text-card-foreground">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground font-medium">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Action Type</th>
                                            <th className="px-4 py-3 text-left">Team / Scope</th>
                                            <th className="px-4 py-3 text-left">Behavior</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {policies.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">
                                                    No custom policy rules defined. System using manual fallback.
                                                </td>
                                            </tr>
                                        )}
                                        {policies.map((p: any) => (
                                            <tr key={p._id} className="group hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-4">
                                                    <code className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-mono text-[10px]">
                                                        {p.actionType === "*" ? "GLOBAL (*)" : p.actionType}
                                                    </code>
                                                </td>
                                                <td className="px-4 py-4">
                                                    {p.teamId ? (
                                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                                            {teams.find(t => t._id === p.teamId)?.name || 'Team'}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                                                            Global Organization
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <Select
                                                        defaultValue={p.policy}
                                                        onValueChange={(val: any) => handleUpdatePolicy({ ...p, policy: val })}
                                                    >
                                                        <SelectTrigger className="w-[140px] h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="auto" className="text-green-500 font-medium">
                                                                <div className="flex items-center">
                                                                    <Zap className="w-3 h-3 mr-2" /> Auto-Approve
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="propose_only" className="text-orange-500 font-medium">
                                                                <div className="flex items-center">
                                                                    <AlertCircle className="w-3 h-3 mr-2" /> Propose Only
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="manual" className="text-red-500 font-medium">
                                                                <div className="flex items-center">
                                                                    <Lock className="w-3 h-3 mr-2" /> Manual HITL
                                                                </div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- SAFETY THRESHOLDS --- */}
                <TabsContent value="thresholds" className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <div className="p-2 w-fit rounded-lg bg-emerald-500/10 mb-2">
                                    <DollarSign className="w-5 h-5 text-emerald-500" />
                                </div>
                                <CardTitle className="text-lg">Cost Gate (Budget Control)</CardTitle>
                                <CardDescription>Automatically pause any mission exceeding this cost.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium">Max Mission Cost ($)</label>
                                        <span className="text-xs font-mono text-emerald-500">$0.50 (Standard)</span>
                                    </div>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        defaultValue="0.50"
                                        className="bg-background/50"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">
                                    "If the estimated cost of this mission is &gt; $0.50, pause for Commander approval."
                                </p>
                                <Button className="w-full" variant="outline">Update Threshold</Button>
                            </CardContent>
                        </Card>

                        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <div className="p-2 w-fit rounded-lg bg-blue-500/10 mb-2">
                                    <BarChart3 className="w-5 h-5 text-blue-500" />
                                </div>
                                <CardTitle className="text-lg">Confidence Trigger</CardTitle>
                                <CardDescription>Threshold at which an agent must ask for confirmation.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium">Min Execution Confidence (%)</label>
                                        <span className="text-xs font-mono text-blue-500">90%</span>
                                    </div>
                                    <Input
                                        type="range"
                                        min="0"
                                        max="100"
                                        defaultValue="90"
                                        className="h-2 bg-blue-500/20 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">
                                    Low Confidence: "I found three ways to fix this. Commander, please select one."
                                </p>
                                <Button className="w-full" variant="outline">Update Threshold</Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

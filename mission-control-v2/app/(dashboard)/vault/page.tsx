"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, ShieldCheck, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function VaultPage() {
    const [keyName, setKeyName] = useState("");
    const [keyValue, setKeyValue] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const secrets = useQuery(api.secrets.listSecrets) || [];
    const setSecretApi = useAction(api.secrets.setSecret);
    const removeSecretApi = useMutation(api.secrets.removeSecret);

    const handleAddKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!keyName || !keyValue) return;

        setIsSubmitting(true);
        try {
            await setSecretApi({ keyName, value: keyValue });
            toast.success(`Key "${keyName}" vaulted successfully!`);
            setKeyName("");
            setKeyValue("");
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to vault key: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveKey = async (name: string) => {
        try {
            await removeSecretApi({ keyName: name });
            toast.success(`Key "${name}" removed.`);
        } catch (err: any) {
            toast.error("Failed to remove key");
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Cloud Vault</h1>
                        <p className="text-muted-foreground"> Securely manage LLM API keys for your entire organization.</p>
                    </div>
                </div>
            </header>

            <div className="grid gap-8">
                {/* Add New Key */}
                <Card className="border-primary/20 bg-primary/5 shadow-2xl shadow-primary/5">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Plus className="w-5 h-5" />
                            Vault New Secret
                        </CardTitle>
                        <CardDescription>
                            LLM keys are encrypted with AES-256-GCM before storage. Only your agent containers can decrypt them.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddKey} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Key Name</label>
                                    <Input
                                        placeholder="openai_api_key"
                                        value={keyName}
                                        onChange={(e) => setKeyName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Value</label>
                                    <Input
                                        type="password"
                                        placeholder="sk-..."
                                        value={keyValue}
                                        onChange={(e) => setKeyValue(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                                Encrypt & Vault Key
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Listing Active Keys */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-muted-foreground" />
                        Active Secrets ({secrets.length})
                    </h3>

                    <div className="grid gap-3">
                        {secrets.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/20">
                                <p className="text-muted-foreground italic">No keys vaulted yet. Recruit agents by adding keys first.</p>
                            </div>
                        ) : (
                            secrets.map((name: string) => (
                                <div key={name} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:border-primary/30 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center font-mono text-xs text-muted-foreground">
                                            ***
                                        </div>
                                        <div>
                                            <p className="font-medium">{name}</p>
                                            <p className="text-xs text-muted-foreground">Encrypted with Org Secret</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleRemoveKey(name)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

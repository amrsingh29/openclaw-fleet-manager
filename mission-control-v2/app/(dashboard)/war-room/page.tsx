"use client";

import { WarRoomChat } from "@/components/dashboard/war-room-chat";

export default function WarRoomPage() {
    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden">
            {/* Full Screen Comms Hub */}
            <div className="flex-1 overflow-hidden">
                <WarRoomChat />
            </div>
        </div>
    );
}

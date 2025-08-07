import React, { useState, useRef, useEffect } from "react";
import { CaretDown, Wrench, Plus } from "@phosphor-icons/react";
import type { IndependentMCPServer } from "../../types/mcp";

interface SkillsDropdownProps {
    threadId: string;
    currentMCPServers: IndependentMCPServer[];
    availableMCPServers: IndependentMCPServer[];
    onMCPServerChange: (servers: IndependentMCPServer[]) => void;
    onManageMCPServers?: () => void;
    className?: string;
}

export const SkillsDropdown: React.FC<SkillsDropdownProps> = ({
    threadId,
    currentMCPServers,
    availableMCPServers,
    onMCPServerChange,
    onManageMCPServers,
    className = "",
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleMCPServerToggle = (server: IndependentMCPServer) => {
        const isCurrentlyActive = currentMCPServers.some((s) => s.id === server.id);

        if (isCurrentlyActive) {
            // Remove MCP server
            const updatedServers = currentMCPServers.filter((s) => s.id !== server.id);
            onMCPServerChange(updatedServers);
        } else {
            // Add MCP server
            const updatedServers = [...currentMCPServers, server];
            onMCPServerChange(updatedServers);
        }
    };

    const getDisplayText = () => {
        if (currentMCPServers.length === 0) {
            return availableMCPServers.length > 0 ? "Add skills..." : "No skills available";
        } else if (currentMCPServers.length === 1) {
            return currentMCPServers[0].name;
        } else {
            return `${currentMCPServers.length} skills`;
        }
    };

    const getServerStatusColor = (server: IndependentMCPServer) => {
        switch (server.status) {
            case 'connected':
                return 'bg-green-500';
            case 'error':
                return 'bg-red-500';
            case 'disconnected':
                return 'bg-gray-400';
            default:
                return 'bg-yellow-500';
        }
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-w-[140px]"
            >
                <Wrench className="h-4 w-4 text-green-500" />
                <span className="text-gray-700 dark:text-neutral-200 flex-1 text-left">{getDisplayText()}</span>
                <CaretDown
                    className={`h-4 w-4 text-gray-400 dark:text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg shadow-lg z-50">
                    <div className="py-2">
                        {/* Current Skills */}
                        {currentMCPServers.length > 0 && (
                            <>
                                <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                                    Active Skills
                                </div>
                                {currentMCPServers.map((server) => (
                                    <div
                                        key={server.id}
                                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-2 h-2 rounded-full ${getServerStatusColor(server)}`} />
                                            <span className="text-sm text-gray-900 dark:text-neutral-100">
                                                {server.name}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleMCPServerToggle(server)}
                                            className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 dark:border-neutral-600 my-1" />
                            </>
                        )}

                        {/* Available Skills */}
                        {availableMCPServers.filter((server) => server.isEnabled && !currentMCPServers.some((s) => s.id === server.id)).length > 0 && (
                            <>
                                <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                                    Available Skills
                                </div>
                                {availableMCPServers
                                    .filter((server) => server.isEnabled && !currentMCPServers.some((s) => s.id === server.id))
                                    .map((server) => (
                                        <button
                                            key={server.id}
                                            onClick={() => handleMCPServerToggle(server)}
                                            className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700 text-left"
                                        >
                                            <div className={`w-2 h-2 rounded-full ${getServerStatusColor(server)}`} />
                                            <span className="text-sm text-gray-900 dark:text-neutral-100 flex-1">
                                                {server.name}
                                            </span>
                                            <Plus className="h-3 w-3 text-gray-400" />
                                        </button>
                                    ))}
                                <div className="border-t border-gray-100 dark:border-neutral-600 my-1" />
                            </>
                        )}

                        {/* Management Link */}
                        {onManageMCPServers && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onManageMCPServers();
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-neutral-700"
                            >
                                <Plus className="h-3 w-3" />
                                <span>Browse Skills</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

import React, { useState, useRef, useEffect } from "react";
import { CaretDown, User, Plus } from "@phosphor-icons/react";
import type { Agent } from "../../types/mcp";

interface AgentDropdownProps {
    threadId: string;
    currentAgents: Agent[];
    availableAgents: Agent[];
    onAgentChange: (agents: Agent[]) => void;
    onManageAgents: () => void;
    className?: string;
}

export const AgentDropdown: React.FC<AgentDropdownProps> = ({
    threadId,
    currentAgents,
    availableAgents,
    onAgentChange,
    onManageAgents,
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

    const handleAgentToggle = (agent: Agent) => {
        const isCurrentlyActive = currentAgents.some((a) => a.id === agent.id);

        if (isCurrentlyActive) {
            // Remove agent
            const updatedAgents = currentAgents.filter((a) => a.id !== agent.id);
            onAgentChange(updatedAgents);
        } else {
            // Add agent
            const updatedAgents = [...currentAgents, agent];
            onAgentChange(updatedAgents);
        }
    };

    const getDisplayText = () => {
        if (currentAgents.length === 0) {
            return availableAgents.length > 0 ? "Choose agent..." : "No agents available";
        } else if (currentAgents.length === 1) {
            return currentAgents[0].name;
        } else {
            return `${currentAgents.length} agents`;
        }
    };

    const getAgentStatusColor = (agent: Agent) => {
        const colorMap: Record<string, string> = {
            blue: "bg-blue-500",
            green: "bg-green-500",
            red: "bg-red-500",
            yellow: "bg-yellow-500",
            purple: "bg-purple-500",
            pink: "bg-pink-500",
            indigo: "bg-indigo-500",
        };
        return colorMap[agent.color] || colorMap.blue;
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-w-[140px]"
            >
                <User className="h-4 w-4 text-blue-500" />
                <span className="text-gray-700 dark:text-neutral-200 flex-1 text-left">{getDisplayText()}</span>
                <CaretDown
                    className={`h-4 w-4 text-gray-400 dark:text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg shadow-lg z-50">
                    <div className="py-2">
                        {/* Current Agents */}
                        {currentAgents.length > 0 && (
                            <>
                                <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                                    Active Agents
                                </div>
                                {currentAgents.map((agent) => (
                                    <div
                                        key={agent.id}
                                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-2 h-2 rounded-full ${getAgentStatusColor(agent)}`} />
                                            <span className="text-sm text-gray-900 dark:text-neutral-100">
                                                {agent.name}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleAgentToggle(agent)}
                                            className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 dark:border-neutral-600 my-1" />
                            </>
                        )}

                        {/* Available Agents */}
                        {availableAgents.filter((agent) => !currentAgents.some((a) => a.id === agent.id)).length > 0 && (
                            <>
                                <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                                    Available Agents
                                </div>
                                {availableAgents
                                    .filter((agent) => !currentAgents.some((a) => a.id === agent.id))
                                    .map((agent) => (
                                        <button
                                            key={agent.id}
                                            onClick={() => handleAgentToggle(agent)}
                                            className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700 text-left"
                                        >
                                            <div className={`w-2 h-2 rounded-full ${getAgentStatusColor(agent)}`} />
                                            <span className="text-sm text-gray-900 dark:text-neutral-100 flex-1">
                                                {agent.name}
                                            </span>
                                            <Plus className="h-3 w-3 text-gray-400" />
                                        </button>
                                    ))}
                                <div className="border-t border-gray-100 dark:border-neutral-600 my-1" />
                            </>
                        )}

                        {/* Management Link */}
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onManageAgents();
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-neutral-700"
                        >
                            <Plus className="h-3 w-3" />
                            <span>Manage Agents</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

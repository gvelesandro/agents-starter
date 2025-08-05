import React, { useState, useRef, useEffect } from "react";
import { CaretDown, User, Plus } from "@phosphor-icons/react";
import type { Agent } from "../../types/mcp";

interface AgentQuickSelectorProps {
    threadId: string;
    currentAgents: Agent[];
    availableAgents: Agent[];
    onAgentChange: (agents: Agent[]) => void;
    onManageAgents: () => void;
    className?: string;
}

export const AgentQuickSelector: React.FC<AgentQuickSelectorProps> = ({
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
            return "No agents";
        } else if (currentAgents.length === 1) {
            return currentAgents[0].name;
        } else {
            return `${currentAgents.length} agents`;
        }
    };

    const getAgentStatusColor = (agent: Agent) => {
        // Colors: blue, green, red, yellow, purple, pink, indigo
        const colorMap: Record<string, string> = {
            blue: "bg-blue-100 text-blue-800 border-blue-200",
            green: "bg-green-100 text-green-800 border-green-200",
            red: "bg-red-100 text-red-800 border-red-200",
            yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
            purple: "bg-purple-100 text-purple-800 border-purple-200",
            pink: "bg-pink-100 text-pink-800 border-pink-200",
            indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
        };
        return colorMap[agent.color] || colorMap.blue;
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">{getDisplayText()}</span>
                <CaretDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="py-2">
                        {/* Current Agents Section */}
                        {currentAgents.length > 0 && (
                            <>
                                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Active Agents
                                </div>
                                {currentAgents.map((agent) => (
                                    <div
                                        key={agent.id}
                                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div
                                                className={`w-3 h-3 rounded-full ${getAgentStatusColor(agent).split(" ")[0]}`}
                                            />
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {agent.name}
                                                </div>
                                                {agent.description && (
                                                    <div className="text-xs text-gray-500 truncate max-w-48">
                                                        {agent.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleAgentToggle(agent)}
                                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 my-2" />
                            </>
                        )}

                        {/* Available Agents Section */}
                        <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Available Agents
                        </div>

                        {availableAgents
                            .filter((agent) => !currentAgents.some((a) => a.id === agent.id))
                            .map((agent) => (
                                <button
                                    key={agent.id}
                                    onClick={() => handleAgentToggle(agent)}
                                    className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 text-left"
                                >
                                    <div
                                        className={`w-3 h-3 rounded-full ${getAgentStatusColor(agent).split(" ")[0]}`}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900">
                                            {agent.name}
                                        </div>
                                        {agent.description && (
                                            <div className="text-xs text-gray-500 truncate">
                                                {agent.description}
                                            </div>
                                        )}
                                        <div className="text-xs text-gray-400">
                                            {agent.mcpGroupIds.length} tool group
                                            {agent.mcpGroupIds.length !== 1 ? "s" : ""}
                                        </div>
                                    </div>
                                    <Plus className="h-4 w-4 text-gray-400" />
                                </button>
                            ))}

                        {/* Manage Agents Link */}
                        <div className="border-t border-gray-100 mt-2">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onManageAgents();
                                }}
                                className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Manage Agents</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

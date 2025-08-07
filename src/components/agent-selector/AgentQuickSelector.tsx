import React, { useState, useRef, useEffect } from "react";
import { CaretDown, User, Plus } from "@phosphor-icons/react";
import type { Agent, IndependentMCPServer } from "../../types/mcp";

interface AgentQuickSelectorProps {
    threadId: string;
    currentAgents: Agent[];
    availableAgents: Agent[];
    availableMCPServers?: IndependentMCPServer[];
    currentMCPServers?: IndependentMCPServer[];
    onAgentChange: (agents: Agent[]) => void;
    onMCPServerChange?: (servers: IndependentMCPServer[]) => void;
    onManageAgents: () => void;
    onManageMCPServers?: () => void;
    className?: string;
}

export const AgentQuickSelector: React.FC<AgentQuickSelectorProps> = ({
    threadId,
    currentAgents,
    availableAgents,
    availableMCPServers = [],
    currentMCPServers = [],
    onAgentChange,
    onMCPServerChange,
    onManageAgents,
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

    const handleMCPServerToggle = (server: IndependentMCPServer) => {
        if (!onMCPServerChange) return;

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
        const totalActive = currentAgents.length + currentMCPServers.length;
        const totalAvailable = availableAgents.length + availableMCPServers.length;

        if (totalActive === 0) {
            return totalAvailable > 0
                ? "Select agent or MCP server"
                : "No agents or servers available";
        } else if (totalActive === 1) {
            if (currentAgents.length === 1) {
                return currentAgents[0].name;
            } else {
                return currentMCPServers[0].name;
            }
        } else {
            const parts = [];
            if (currentAgents.length > 0) {
                parts.push(`${currentAgents.length} agent${currentAgents.length > 1 ? 's' : ''}`);
            }
            if (currentMCPServers.length > 0) {
                parts.push(`${currentMCPServers.length} server${currentMCPServers.length > 1 ? 's' : ''}`);
            }
            return parts.join(', ');
        }
    };

    const getAgentStatusColor = (agent: Agent) => {
        // Colors: blue, green, red, yellow, purple, pink, indigo
        const colorMap: Record<string, string> = {
            blue: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700",
            green: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700",
            red: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700",
            yellow: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700",
            purple: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700",
            pink: "bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-700",
            indigo: "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700",
        };
        return colorMap[agent.color] || colorMap.blue;
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
                <User className="h-4 w-4 text-gray-500 dark:text-neutral-400" />
                <span className="text-gray-700 dark:text-neutral-200">{getDisplayText()}</span>
                <CaretDown
                    className={`h-4 w-4 text-gray-400 dark:text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg shadow-lg z-50">
                    <div className="py-2">
                        {/* Current Agents Section */}
                        {currentAgents.length > 0 && (
                            <>
                                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                                    Active Agents
                                </div>
                                {currentAgents.map((agent) => (
                                    <div
                                        key={agent.id}
                                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div
                                                className={`w-3 h-3 rounded-full ${getAgentStatusColor(agent).split(" ")[0]} ${getAgentStatusColor(agent).split(" ")[1]}`}
                                            />
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">
                                                    {agent.name}
                                                </div>
                                                {agent.description && (
                                                    <div className="text-xs text-gray-500 dark:text-neutral-400 truncate max-w-48">
                                                        {agent.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleAgentToggle(agent)}
                                            className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 dark:border-neutral-600 my-2" />
                            </>
                        )}

                        {/* Current MCP Servers Section */}
                        {currentMCPServers.length > 0 && (
                            <>
                                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                                    Active MCP Servers
                                </div>
                                {currentMCPServers.map((server) => (
                                    <div
                                        key={server.id}
                                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className={`w-3 h-3 rounded-full ${server.status === 'connected' ? 'bg-green-500' :
                                                    server.status === 'error' ? 'bg-red-500' :
                                                        server.status === 'disconnected' ? 'bg-gray-400' :
                                                            'bg-yellow-500'
                                                }`} />
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">
                                                    {server.name}
                                                </div>
                                                {server.description && (
                                                    <div className="text-xs text-gray-500 dark:text-neutral-400 truncate max-w-48">
                                                        {server.description}
                                                    </div>
                                                )}
                                                <div className="text-xs text-gray-400 dark:text-neutral-500">
                                                    {server.transport} • {server.tools?.length || 0} tools
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleMCPServerToggle(server)}
                                            className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 dark:border-neutral-600 my-2" />
                            </>
                        )}

                        {/* Available Agents Section */}
                        {availableAgents.filter((agent) => !currentAgents.some((a) => a.id === agent.id)).length > 0 && (
                            <>
                                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                                    Available Agents
                                </div>

                                {availableAgents
                                    .filter((agent) => !currentAgents.some((a) => a.id === agent.id))
                                    .map((agent) => (
                                        <button
                                            key={agent.id}
                                            onClick={() => handleAgentToggle(agent)}
                                            className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700 text-left"
                                        >
                                            <div
                                                className={`w-3 h-3 rounded-full ${getAgentStatusColor(agent).split(" ")[0]} ${getAgentStatusColor(agent).split(" ")[1]}`}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">
                                                    {agent.name}
                                                </div>
                                                {agent.description && (
                                                    <div className="text-xs text-gray-500 dark:text-neutral-400 truncate">
                                                        {agent.description}
                                                    </div>
                                                )}
                                                <div className="text-xs text-gray-400 dark:text-neutral-500">
                                                    {agent.mcpGroupIds.length} tool group
                                                    {agent.mcpGroupIds.length !== 1 ? "s" : ""}
                                                </div>
                                            </div>
                                            <Plus className="h-4 w-4 text-gray-400 dark:text-neutral-500" />
                                        </button>
                                    ))}
                                <div className="border-t border-gray-100 dark:border-neutral-600 my-2" />
                            </>
                        )}

                        {/* Available MCP Servers Section */}
                        {availableMCPServers.length > 0 && (
                            <>
                                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                                    Individual MCP Servers
                                </div>
                                {availableMCPServers
                                    .filter((server) => server.isEnabled && !currentMCPServers.some((s) => s.id === server.id))
                                    .map((server) => (
                                        <button
                                            key={server.id}
                                            onClick={() => handleMCPServerToggle(server)}
                                            className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700 text-left"
                                        >
                                            <div className={`w-3 h-3 rounded-full ${server.status === 'connected' ? 'bg-green-500' :
                                                    server.status === 'error' ? 'bg-red-500' :
                                                        server.status === 'disconnected' ? 'bg-gray-400' :
                                                            'bg-yellow-500'
                                                }`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">
                                                    {server.name}
                                                </div>
                                                {server.description && (
                                                    <div className="text-xs text-gray-500 dark:text-neutral-400 truncate">
                                                        {server.description}
                                                    </div>
                                                )}
                                                <div className="text-xs text-gray-400 dark:text-neutral-500">
                                                    {server.transport} • {server.tools?.length || 0} tools
                                                </div>
                                            </div>
                                            <Plus className="h-4 w-4 text-gray-400 dark:text-neutral-500" />
                                        </button>
                                    ))}
                                <div className="border-t border-gray-100 dark:border-neutral-600 my-2" />
                            </>
                        )}

                        {/* Management Links */}
                        <div>
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onManageAgents();
                                }}
                                className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Manage Agents</span>
                            </button>

                            {onManageMCPServers && (
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        onManageMCPServers();
                                    }}
                                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-300"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>MCP Server Library</span>
                                </button>
                            )}

                            {/* Show a message when no agents or servers are available */}
                            {availableAgents.length === 0 && availableMCPServers.length === 0 && (
                                <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-neutral-400">
                                    <div className="mb-2">No agents or MCP servers configured</div>
                                    <div className="text-xs">Create your first agent or add an MCP server to get started</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

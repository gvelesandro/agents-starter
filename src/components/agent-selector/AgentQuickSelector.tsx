import React from "react";
import { AgentDropdown } from "./AgentDropdown";
import { SkillsDropdown } from "./SkillsDropdown";
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
    return (
        <div className={`flex items-center space-x-3 ${className}`}>
            <AgentDropdown
                threadId={threadId}
                currentAgents={currentAgents}
                availableAgents={availableAgents}
                onAgentChange={onAgentChange}
                onManageAgents={onManageAgents}
            />
            {onMCPServerChange && (
                <SkillsDropdown
                    threadId={threadId}
                    currentMCPServers={currentMCPServers}
                    availableMCPServers={availableMCPServers}
                    onMCPServerChange={onMCPServerChange}
                    onManageMCPServers={onManageMCPServers}
                />
            )}
        </div>
    );
};

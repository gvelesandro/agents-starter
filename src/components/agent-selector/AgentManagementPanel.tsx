import React, { useState } from 'react';
import { Plus, Gear, X } from '@phosphor-icons/react';
import type { Agent, MCPGroup } from '../../types/mcp';

interface AgentManagementPanelProps {
    isOpen: boolean;
    onClose: () => void;
    agents: Agent[];
    mcpGroups: MCPGroup[];
    onCreateAgent: (agent: Omit<Agent, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
    onUpdateAgent: (agentId: string, updates: Partial<Agent>) => void;
    onDeleteAgent: (agentId: string) => void;
}

const colors = [
    { name: 'Blue', value: 'blue', bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-200 dark:border-blue-700' },
    { name: 'Green', value: 'green', bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', border: 'border-green-200 dark:border-green-700' },
    { name: 'Purple', value: 'purple', bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-200 dark:border-purple-700' },
    { name: 'Red', value: 'red', bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', border: 'border-red-200 dark:border-red-700' },
    { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200', border: 'border-yellow-200 dark:border-yellow-700' },
    { name: 'Pink', value: 'pink', bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-800 dark:text-pink-200', border: 'border-pink-200 dark:border-pink-700' },
];

export const AgentManagementPanel: React.FC<AgentManagementPanelProps> = ({
    isOpen,
    onClose,
    agents,
    mcpGroups,
    onCreateAgent,
    onUpdateAgent,
    onDeleteAgent
}) => {
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        persona: '',
        color: 'blue',
        mcpGroupIds: [] as string[]
    });

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            persona: '',
            color: 'blue',
            mcpGroupIds: []
        });
        setEditingAgent(null);
        setIsCreating(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingAgent) {
            onUpdateAgent(editingAgent.id, formData);
        } else {
            onCreateAgent({
                ...formData,
                isActive: false,
                lastUsed: undefined
            });
        }

        resetForm();
    };

    const startEdit = (agent: Agent) => {
        setFormData({
            name: agent.name,
            description: agent.description || '',
            persona: agent.persona || '',
            color: agent.color,
            mcpGroupIds: agent.mcpGroupIds
        });
        setEditingAgent(agent);
        setIsCreating(true);
    };

    const getColorClasses = (colorValue: string) => {
        const color = colors.find(c => c.value === colorValue) || colors[0];
        return `${color.bg} ${color.text} ${color.border}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-neutral-100">Agent Management</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full"
                    >
                        <X className="h-5 w-5 text-gray-500 dark:text-neutral-400" />
                    </button>
                </div>

                <div className="flex h-[calc(90vh-80px)]">
                    {/* Agents List */}
                    <div className="w-1/2 p-6 border-r border-gray-200 dark:border-neutral-700 overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-neutral-100">Your Agents</h3>
                            <button
                                onClick={() => setIsCreating(true)}
                                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
                            >
                                <Plus className="h-4 w-4" />
                                <span>New Agent</span>
                            </button>
                        </div>

                        <div className="space-y-3">
                            {agents.map((agent) => (
                                <div
                                    key={agent.id}
                                    className="p-4 border border-gray-200 dark:border-neutral-600 rounded-lg hover:border-gray-300 dark:hover:border-neutral-500 bg-white dark:bg-neutral-800"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <div className={`w-3 h-3 rounded-full bg-${agent.color}-500`} />
                                                <h4 className="font-medium text-gray-900 dark:text-neutral-100">{agent.name}</h4>
                                                {agent.isActive && (
                                                    <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            {agent.description && (
                                                <p className="text-sm text-gray-600 dark:text-neutral-300 mb-2">{agent.description}</p>
                                            )}
                                            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-neutral-400">
                                                <span>{agent.mcpGroupIds.length} tool groups</span>
                                                <span>Used {agent.usageCount} times</span>
                                                {agent.lastUsed && (
                                                    <span>Last used {new Date(agent.lastUsed).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => startEdit(agent)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full"
                                            >
                                                <Gear className="h-4 w-4 text-gray-500 dark:text-neutral-400" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteAgent(agent.id)}
                                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full"
                                            >
                                                <X className="h-4 w-4 text-red-500 dark:text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {agents.length === 0 && (
                                <div className="text-center py-8 text-gray-500 dark:text-neutral-400">
                                    <Plus className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-neutral-600" />
                                    <p>No agents created yet</p>
                                    <p className="text-sm">Create your first AI agent to get started</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Agent Form */}
                    <div className="w-1/2 p-6 overflow-y-auto bg-gray-50 dark:bg-neutral-800">
                        {isCreating ? (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-neutral-100">
                                    {editingAgent ? 'Edit Agent' : 'Create New Agent'}
                                </h3>

                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                                        Agent Name *
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="e.g., GitHub Assistant, Data Analyst"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        rows={3}
                                        placeholder="Brief description of what this agent does"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="persona" className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                                        Persona Instructions
                                    </label>
                                    <textarea
                                        id="persona"
                                        value={formData.persona}
                                        onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        rows={4}
                                        placeholder="Specific instructions for how this agent should behave and respond"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                                        Color Theme
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {colors.map((color) => (
                                            <button
                                                key={color.value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color: color.value })}
                                                className={`px-3 py-2 rounded-lg border text-sm ${formData.color === color.value
                                                        ? `${color.bg} ${color.text} ${color.border} border-2`
                                                        : 'bg-gray-50 dark:bg-neutral-700 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-600'
                                                    }`}
                                            >
                                                {color.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                                        MCP Tool Groups
                                    </label>
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {mcpGroups.map((group) => (
                                            <label key={group.id} className="flex items-center space-x-3">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.mcpGroupIds.includes(group.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({
                                                                ...formData,
                                                                mcpGroupIds: [...formData.mcpGroupIds, group.id]
                                                            });
                                                        } else {
                                                            setFormData({
                                                                ...formData,
                                                                mcpGroupIds: formData.mcpGroupIds.filter(id => id !== group.id)
                                                            });
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 dark:border-neutral-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 bg-white dark:bg-neutral-700"
                                                />
                                                <div className="flex items-center space-x-2">
                                                    <div className={`w-3 h-3 rounded-full bg-${group.color}-500`} />
                                                    <span className="text-sm text-gray-900 dark:text-neutral-100">{group.name}</span>
                                                    <span className="text-xs text-gray-500 dark:text-neutral-400">
                                                        ({group.serverIds.length} servers)
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    {mcpGroups.length === 0 && (
                                        <p className="text-sm text-gray-500 dark:text-neutral-400 italic">
                                            No MCP tool groups available. Create MCP servers first.
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center space-x-3 pt-4 border-t border-gray-200 dark:border-neutral-600">
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 font-medium"
                                    >
                                        {editingAgent ? 'Update Agent' : 'Create Agent'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-4 py-2 text-gray-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-600"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="text-center py-12 text-gray-500 dark:text-neutral-400">
                                <Gear className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-neutral-600" />
                                <p>Select an agent to edit or create a new one</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

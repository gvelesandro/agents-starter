import React, { useState } from 'react';
import { Plus, Gear, X, TestTube, CloudCheck, CloudX, Warning, Database } from '@phosphor-icons/react';
import { MCPServerConfigModal } from '../mcp-config/MCPServerConfigModal';
import { cn } from '@/lib/utils';

interface MCPServer {
    id: string;
    name: string;
    url: string;
    transport: 'websocket' | 'sse';
    authType: 'none' | 'apikey' | 'basic' | 'oauth2' | 'custom';
    credentials?: {
        apiKey?: string;
        username?: string;
        password?: string;
    };
    isEnabled: boolean;
    status?: 'connected' | 'disconnected' | 'error' | 'authenticating' | 'pending_auth';
    description?: string;
    tools?: string[];
    lastTested?: Date;
    createdAt: Date;
    updatedAt: Date;
}

interface MCPServerLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    servers: MCPServer[];
    onCreateServer: (serverConfig: any) => Promise<void>;
    onUpdateServer: (serverId: string, serverConfig: any) => Promise<void>;
    onDeleteServer: (serverId: string) => Promise<void>;
    onTestServer: (serverId: string) => Promise<{ success: boolean; message: string; tools?: string[] }>;
}

export const MCPServerLibrary: React.FC<MCPServerLibraryProps> = ({
    isOpen,
    onClose,
    servers,
    onCreateServer,
    onUpdateServer,
    onDeleteServer,
    onTestServer
}) => {
    const [configModal, setConfigModal] = useState<{
        isOpen: boolean;
        mode: 'create' | 'edit';
        server?: MCPServer;
    }>({
        isOpen: false,
        mode: 'create',
        server: undefined
    });

    const [testingServers, setTestingServers] = useState<Set<string>>(new Set());

    const handleCreateServer = () => {
        setConfigModal({
            isOpen: true,
            mode: 'create',
            server: undefined
        });
    };

    const handleEditServer = (server: MCPServer) => {
        setConfigModal({
            isOpen: true,
            mode: 'edit',
            server
        });
    };

    const handleSaveServer = async (config: any) => {
        try {
            if (configModal.mode === 'create') {
                await onCreateServer(config);
            } else if (configModal.server) {
                await onUpdateServer(configModal.server.id, config);
            }
            setConfigModal({ isOpen: false, mode: 'create', server: undefined });
        } catch (error) {
            console.error('Error saving server:', error);
        }
    };

    const handleTestServer = async (serverId: string) => {
        setTestingServers(prev => new Set(prev).add(serverId));
        try {
            await onTestServer(serverId);
        } finally {
            setTestingServers(prev => {
                const newSet = new Set(prev);
                newSet.delete(serverId);
                return newSet;
            });
        }
    };

    const getStatusIcon = (server: MCPServer) => {
        if (testingServers.has(server.id)) {
            return <TestTube className="h-4 w-4 animate-spin text-blue-500" />;
        }

        switch (server.status) {
            case 'connected':
                return <CloudCheck className="h-4 w-4 text-green-500" />;
            case 'error':
                return <CloudX className="h-4 w-4 text-red-500" />;
            case 'disconnected':
                return <CloudX className="h-4 w-4 text-gray-400" />;
            default:
                return <Warning className="h-4 w-4 text-yellow-500" />;
        }
    };

    const getStatusColor = (server: MCPServer) => {
        if (testingServers.has(server.id)) return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300';

        switch (server.status) {
            case 'connected':
                return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-300';
            case 'error':
                return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300';
            case 'disconnected':
                return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-300';
            default:
                return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-300';
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
                        <div className="flex items-center space-x-3">
                            <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-neutral-100">MCP Server Library</h2>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleCreateServer}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Add Server</span>
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full"
                            >
                                <X className="h-5 w-5 text-gray-500 dark:text-neutral-400" />
                            </button>
                        </div>
                    </div>

                    {/* Server List */}
                    <div className="p-6">
                        {servers.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 dark:text-neutral-400">
                                <Database className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-neutral-600" />
                                <h3 className="text-lg font-medium mb-2">No MCP Servers</h3>
                                <p className="mb-4">Create your first MCP server to get started.</p>
                                <button
                                    onClick={handleCreateServer}
                                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add Your First Server</span>
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {servers.map((server) => (
                                    <div
                                        key={server.id}
                                        className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700"
                                    >
                                        {/* Server Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-medium text-gray-900 dark:text-neutral-100 mb-1">
                                                    {server.name}
                                                </h3>
                                                <p className="text-xs text-gray-500 dark:text-neutral-400 break-all">
                                                    {server.url}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-1 ml-2">
                                                <button
                                                    onClick={() => handleTestServer(server.id)}
                                                    disabled={testingServers.has(server.id)}
                                                    className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400"
                                                    title="Test Connection"
                                                >
                                                    <TestTube className={cn("h-4 w-4", testingServers.has(server.id) && "animate-spin")} />
                                                </button>
                                                <button
                                                    onClick={() => handleEditServer(server)}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                                                    title="Edit Server"
                                                >
                                                    <Gear className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => onDeleteServer(server.id)}
                                                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400"
                                                    title="Delete Server"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Server Details */}
                                        <div className="space-y-2">
                                            {/* Status */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500 dark:text-neutral-400">Status</span>
                                                <div className={cn(
                                                    "flex items-center space-x-1 px-2 py-1 rounded-full text-xs",
                                                    getStatusColor(server)
                                                )}>
                                                    {getStatusIcon(server)}
                                                    <span className="capitalize">
                                                        {testingServers.has(server.id) ? 'Testing...' : server.status || 'Unknown'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Transport */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500 dark:text-neutral-400">Transport</span>
                                                <span className="text-xs text-gray-700 dark:text-neutral-300 capitalize">
                                                    {server.transport}
                                                </span>
                                            </div>

                                            {/* Authentication */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500 dark:text-neutral-400">Auth</span>
                                                <span className="text-xs text-gray-700 dark:text-neutral-300 capitalize">
                                                    {server.authType === 'none' ? 'None' :
                                                        server.authType === 'apikey' ? 'API Key' :
                                                            server.authType === 'basic' ? 'Basic Auth' : server.authType}
                                                </span>
                                            </div>

                                            {/* Tools Count */}
                                            {server.tools && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-500 dark:text-neutral-400">Tools</span>
                                                    <span className="text-xs text-gray-700 dark:text-neutral-300">
                                                        {server.tools.length} available
                                                    </span>
                                                </div>
                                            )}

                                            {/* Last Tested */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-500 dark:text-gray-400">Last Tested</span>
                                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {server.lastTested
                                                        ? new Date(server.lastTested).toLocaleDateString()  // Convert string to Date first
                                                        : 'Never'}
                                                </span>
                                            </div>

                                            {/* Created Date - if shown */}
                                            {server.createdAt && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">Created</span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        {new Date(server.createdAt).toLocaleDateString()}  {/* Convert string to Date */}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Updated Date - if shown */}
                                            {server.updatedAt && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">Updated</span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        {new Date(server.updatedAt).toLocaleDateString()}  {/* Convert string to Date */}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Enable/Disable Toggle */}
                                            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-neutral-600">
                                                <span className="text-xs text-gray-500 dark:text-neutral-400">Enabled</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={server.isEnabled}
                                                        onChange={() => onUpdateServer(server.id, { ...server, isEnabled: !server.isEnabled })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Server Config Modal */}
            {configModal.isOpen && (
                <MCPServerConfigModal
                    isOpen={configModal.isOpen}
                    onClose={() => setConfigModal({ isOpen: false, mode: 'create', server: undefined })}
                    onSave={handleSaveServer}
                    mode={configModal.mode}
                    groupId="" // Not needed for independent servers
                    server={configModal.server}
                />
            )}
        </>
    );
};

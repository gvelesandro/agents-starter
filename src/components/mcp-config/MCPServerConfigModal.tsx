import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/modal/Modal';
import { Button } from '@/components/button/Button';
import { Input } from '@/components/input/Input';
import { Label } from '@/components/label/Label';
import { X, TestTube, CloudCheck, CloudX, Warning } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface MCPServerConfig {
    id?: string;
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
}

interface MCPServerConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: MCPServerConfig) => Promise<void>;
    groupId?: string; // Optional - for when adding to groups
    server?: MCPServerConfig;
    mode: 'create' | 'edit';
}

export const MCPServerConfigModal: React.FC<MCPServerConfigModalProps> = ({
    isOpen,
    onClose,
    onSave,
    groupId,
    server,
    mode
}) => {
    const [formData, setFormData] = useState<MCPServerConfig>({
        name: '',
        url: '',
        transport: 'websocket',
        authType: 'none',
        isEnabled: true,
        credentials: {}
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Initialize form data when modal opens
    useEffect(() => {
        if (isOpen) {
            if (server && mode === 'edit') {
                setFormData(server);
            } else {
                // Reset form for create mode
                setFormData({
                    name: '',
                    url: '',
                    transport: 'websocket',
                    authType: 'none',
                    isEnabled: true,
                    credentials: {}
                });
            }
            setTestResult(null);
        }
    }, [isOpen, server, mode]);

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleCredentialChange = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            credentials: {
                ...prev.credentials,
                [field]: value
            }
        }));
    };

    const testConnection = async () => {
        console.log('🚀 Starting connection test for:', formData.url);
        setIsTesting(true);
        setTestResult(null);

        try {
            // First, we need to save the server to get an ID for testing
            if (!server?.id) {
                // If no server ID, create the server first
                const serverData = {
                    name: formData.name || 'Unnamed Server',
                    url: formData.url,
                    transport: formData.transport,
                    authType: formData.authType,
                    credentials: formData.credentials,
                    isEnabled: true
                };

                console.log('📤 Creating server for testing:', serverData);
                const createResponse = await fetch('/api/mcp-servers-independent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(serverData)
                });

                if (!createResponse.ok) {
                    throw new Error('Failed to create server for testing');
                }

                const createResult = await createResponse.json() as { server: MCPServerConfig };
                const tempServerId = createResult.server.id;

                if (!tempServerId) {
                    throw new Error('Failed to get server ID from creation response');
                }

                // Now test the connection
                console.log('🔍 Testing connection to server:', tempServerId);
                const testResponse = await fetch(`/api/mcp-servers-independent/${tempServerId}/test`, {
                    method: 'POST',
                    credentials: 'include'
                });

                if (!testResponse.ok) {
                    throw new Error('Test request failed');
                }

                const result = await testResponse.json() as { success: boolean; message: string; tools?: string[] };
                setTestResult(result);

                // If test was successful and we want to save, update the form with the new server ID
                if (result.success && onSave) {
                    await onSave({ ...serverData, id: tempServerId });
                }
            } else {
                // Server exists, just test it
                console.log('🔍 Testing existing server:', server.id);
                const testResponse = await fetch(`/api/mcp-servers-independent/${server.id}/test`, {
                    method: 'POST',
                    credentials: 'include'
                });

                if (!testResponse.ok) {
                    throw new Error('Test request failed');
                }

                const result = await testResponse.json() as { success: boolean; message: string; tools?: string[] };
                setTestResult(result);
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            setTestResult({
                success: false,
                message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        } finally {
            setIsTesting(false);
        }
    }; const handleSave = async () => {
        if (!formData.name.trim() || !formData.url.trim()) {
            return;
        }

        setIsLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Failed to save MCP server:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getAuthFormFields = () => {
        switch (formData.authType) {
            case 'apikey':
                return (
                    <div className="space-y-4">
                        <Label title="API Key" htmlFor="apiKey">
                            <Input
                                id="apiKey"
                                type="password"
                                initialValue={formData.credentials?.apiKey || ''}
                                onValueChange={(value) => handleCredentialChange('apiKey', value)}
                                placeholder="Enter your API key"
                            />
                        </Label>
                    </div>
                );

            case 'basic':
                return (
                    <div className="space-y-4">
                        <Label title="Username" htmlFor="username">
                            <Input
                                id="username"
                                initialValue={formData.credentials?.username || ''}
                                onValueChange={(value) => handleCredentialChange('username', value)}
                                placeholder="Enter username"
                            />
                        </Label>
                        <Label title="Password" htmlFor="password">
                            <Input
                                id="password"
                                type="password"
                                initialValue={formData.credentials?.password || ''}
                                onValueChange={(value) => handleCredentialChange('password', value)}
                                placeholder="Enter password"
                            />
                        </Label>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} clickOutsideToClose={false}>
            <div className="w-full max-w-2xl bg-white dark:bg-neutral-800 rounded-lg shadow-xl">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-600">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {mode === 'create' ? 'Add MCP Server' : 'Edit MCP Server'}
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="p-2"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
                    {/* Basic Configuration */}
                    <div className="space-y-4">
                        <Label title="Server Name" htmlFor="serverName">
                            <Input
                                id="serverName"
                                initialValue={formData.name}
                                onValueChange={(value) => handleInputChange('name', value)}
                                placeholder="e.g., GitHub MCP Server"
                            />
                        </Label>

                        <Label title="Server URL" htmlFor="serverUrl">
                            <Input
                                id="serverUrl"
                                initialValue={formData.url}
                                onValueChange={(value) => handleInputChange('url', value)}
                                placeholder="ws://localhost:3000 or https://api.example.com"
                            />
                        </Label>

                        <Label title="Transport Protocol" htmlFor="transport">
                            <select
                                id="transport"
                                value={formData.transport}
                                onChange={(e) => handleInputChange('transport', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-900 dark:text-white"
                            >
                                <option value="websocket">WebSocket</option>
                                <option value="sse">Server-Sent Events</option>
                            </select>
                        </Label>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="isEnabled"
                                checked={formData.isEnabled}
                                onChange={(e) => handleInputChange('isEnabled', e.target.checked)}
                                className="rounded border-gray-300 dark:border-neutral-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 bg-white dark:bg-neutral-700"
                            />
                            <label htmlFor="isEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                                Enable this server
                            </label>
                        </div>
                    </div>

                    {/* Authentication Configuration */}
                    <div className="space-y-4">
                        <Label title="Authentication Type" htmlFor="authType">
                            <select
                                id="authType"
                                value={formData.authType}
                                onChange={(e) => {
                                    handleInputChange('authType', e.target.value);
                                    setFormData(prev => ({ ...prev, credentials: {} }));
                                }}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-900 dark:text-white"
                            >
                                <option value="none">No Authentication</option>
                                <option value="apikey">API Key</option>
                                <option value="basic">Basic Auth</option>
                                <option value="oauth2">OAuth 2.0 (Future)</option>
                                <option value="custom">Custom Headers (Future)</option>
                            </select>
                        </Label>

                        {getAuthFormFields()}
                    </div>

                    {/* Connection Test */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Connection Test</span>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={testConnection}
                                disabled={isTesting || !formData.url.trim()}
                                className="flex items-center space-x-2"
                            >
                                <TestTube className={cn("h-4 w-4", isTesting && "animate-spin")} />
                                <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                            </Button>
                        </div>

                        {testResult && (
                            <div className={cn(
                                "flex items-center space-x-2 p-3 rounded-lg text-sm",
                                testResult.success
                                    ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                                    : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                            )}>
                                {testResult.success ? (
                                    <CloudCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : (
                                    <CloudX className="h-4 w-4 text-red-600 dark:text-red-400" />
                                )}
                                <span>{testResult.message}</span>
                            </div>
                        )}
                    </div>

                    {/* Server Status Display (for edit mode) */}
                    {mode === 'edit' && server?.status && (
                        <div className="space-y-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Status</span>
                            <div className={cn(
                                "flex items-center space-x-2 p-3 rounded-lg text-sm",
                                server.status === 'connected'
                                    ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                                    : server.status === 'error'
                                        ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                                        : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200"
                            )}>
                                {server.status === 'connected' ? (
                                    <CloudCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : server.status === 'error' ? (
                                    <CloudX className="h-4 w-4 text-red-600 dark:text-red-400" />
                                ) : (
                                    <Warning className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                )}
                                <span className="capitalize">{server.status}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-neutral-600">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isLoading || !formData.name.trim() || !formData.url.trim()}
                    >
                        {isLoading ? 'Saving...' : mode === 'create' ? 'Add Server' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

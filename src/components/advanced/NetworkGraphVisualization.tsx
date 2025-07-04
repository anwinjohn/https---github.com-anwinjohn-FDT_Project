import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ForceGraph2D } from 'react-force-graph';
import { useTheme } from '../../context/ThemeContext';
import { Network, AlertCircle, Loader2, Download, Filter, Search, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';
import { useNotifications } from '../notifications';

interface GraphNode {
  id: string;
  name: string;
  val: number;
  group: string;
  color?: string;
  risk?: 'high' | 'medium' | 'low';
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface NetworkGraphVisualizationProps {
  data?: GraphData;
  isLoading?: boolean;
  title?: string;
  description?: string;
}

const NetworkGraphVisualization: React.FC<NetworkGraphVisualizationProps> = ({
  data,
  isLoading = false,
  title = "Fraud Network Analysis",
  description = "Interactive visualization of suspicious transaction networks and relationships"
}) => {
  const { theme } = useTheme();
  const { addNotification } = useNotifications();
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Generate mock data if none provided
  useEffect(() => {
    if (data) {
      setGraphData(data);
    } else {
      // Generate mock data for demonstration
      const mockData: GraphData = {
        nodes: [
          { id: 'customer1', name: 'John Smith', val: 20, group: 'customer', risk: 'high' },
          { id: 'customer2', name: 'Alice Johnson', val: 15, group: 'customer', risk: 'medium' },
          { id: 'customer3', name: 'Robert Brown', val: 10, group: 'customer', risk: 'low' },
          { id: 'customer4', name: 'Emily Davis', val: 25, group: 'customer', risk: 'high' },
          { id: 'beneficiary1', name: 'Global Traders Ltd', val: 18, group: 'beneficiary' },
          { id: 'beneficiary2', name: 'Overseas Ventures', val: 12, group: 'beneficiary' },
          { id: 'beneficiary3', name: 'United Exports', val: 15, group: 'beneficiary' },
          { id: 'beneficiary4', name: 'International Shipping', val: 10, group: 'beneficiary' },
          { id: 'beneficiary5', name: 'Pacific Trading Co', val: 8, group: 'beneficiary' },
          { id: 'country1', name: 'Hong Kong', val: 25, group: 'country' },
          { id: 'country2', name: 'Singapore', val: 20, group: 'country' },
          { id: 'country3', name: 'UAE', val: 30, group: 'country' },
          { id: 'branch1', name: 'Main Branch', val: 15, group: 'branch' },
          { id: 'branch2', name: 'Downtown Branch', val: 12, group: 'branch' },
          { id: 'branch3', name: 'Airport Branch', val: 10, group: 'branch' },
        ],
        links: [
          { source: 'customer1', target: 'beneficiary1', value: 5, type: 'transaction' },
          { source: 'customer1', target: 'beneficiary2', value: 3, type: 'transaction' },
          { source: 'customer1', target: 'beneficiary3', value: 2, type: 'transaction' },
          { source: 'customer2', target: 'beneficiary1', value: 2, type: 'transaction' },
          { source: 'customer2', target: 'beneficiary4', value: 4, type: 'transaction' },
          { source: 'customer3', target: 'beneficiary5', value: 3, type: 'transaction' },
          { source: 'customer4', target: 'beneficiary2', value: 6, type: 'transaction' },
          { source: 'customer4', target: 'beneficiary3', value: 2, type: 'transaction' },
          { source: 'beneficiary1', target: 'country1', value: 4, type: 'location' },
          { source: 'beneficiary2', target: 'country2', value: 3, type: 'location' },
          { source: 'beneficiary3', target: 'country3', value: 5, type: 'location' },
          { source: 'beneficiary4', target: 'country1', value: 2, type: 'location' },
          { source: 'beneficiary5', target: 'country2', value: 3, type: 'location' },
          { source: 'customer1', target: 'branch1', value: 2, type: 'service' },
          { source: 'customer2', target: 'branch2', value: 3, type: 'service' },
          { source: 'customer3', target: 'branch3', value: 2, type: 'service' },
          { source: 'customer4', target: 'branch1', value: 4, type: 'service' },
        ]
      };
      
      // Add colors based on group and risk
      mockData.nodes = mockData.nodes.map(node => {
        let color;
        if (node.group === 'customer') {
          color = node.risk === 'high' ? '#ef4444' : node.risk === 'medium' ? '#f97316' : '#22c55e';
        } else if (node.group === 'beneficiary') {
          color = '#3b82f6';
        } else if (node.group === 'country') {
          color = '#8b5cf6';
        } else if (node.group === 'branch') {
          color = '#ec4899';
        }
        return { ...node, color };
      });
      
      setGraphData(mockData);
    }
  }, [data]);

  // Handle search
  useEffect(() => {
    if (!searchTerm || !graphData) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const matchedNodes = new Set();
    const connectedLinks = new Set();
    
    // Find nodes that match the search term
    graphData.nodes.forEach(node => {
      if (node.name.toLowerCase().includes(searchLower) || 
          node.id.toLowerCase().includes(searchLower) ||
          node.group.toLowerCase().includes(searchLower)) {
        matchedNodes.add(node.id);
      }
    });
    
    // Find links connected to matched nodes
    graphData.links.forEach(link => {
      if (matchedNodes.has(link.source) || matchedNodes.has(link.target)) {
        connectedLinks.add(link);
        // Also add the connected nodes
        matchedNodes.add(link.source);
        matchedNodes.add(link.target);
      }
    });
    
    setHighlightNodes(matchedNodes);
    setHighlightLinks(connectedLinks);
  }, [searchTerm, graphData]);

  const handleNodeClick = (node: GraphNode) => {
    // Center view on node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(2, 1000);
    }
    
    // Show node details
    addNotification(
      `${node.name} (${node.group})`,
      'info',
      5000,
      node.group === 'customer' ? 'Customer Details' : 
      node.group === 'beneficiary' ? 'Beneficiary Details' : 
      node.group === 'country' ? 'Country Details' : 'Branch Details'
    );
  };

  const handleZoomIn = () => {
    if (graphRef.current) {
      const newZoom = zoomLevel * 1.2;
      graphRef.current.zoom(newZoom, 800);
      setZoomLevel(newZoom);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const newZoom = zoomLevel / 1.2;
      graphRef.current.zoom(newZoom, 800);
      setZoomLevel(newZoom);
    }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    
    setIsFullscreen(!isFullscreen);
  };

  const handleExport = () => {
    if (!graphRef.current || !graphData) return;
    
    try {
      // Create a screenshot of the graph
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        throw new Error('Canvas element not found');
      }
      
      const dataUrl = canvas.toDataURL('image/png');
      
      // Create a download link
      const link = document.createElement('a');
      link.download = `fraud-network-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
      
      addNotification('Network graph exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting graph:', error);
      addNotification('Failed to export network graph', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${
        theme === 'dark' 
          ? 'bg-white/10 border-white/20' 
          : 'bg-white border-gray-200'
      } backdrop-blur-xl`}
      ref={containerRef}
    >
      <div className={`flex justify-between items-center p-6 border-b ${
        theme === 'dark' ? 'border-white/20' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
            <Network className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>{title}</h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-purple-200/70' : 'text-purple-600'
            }`}>{description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search nodes..."
              className={`w-48 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                theme === 'dark' 
                  ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                  : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          
          <button
            onClick={handleZoomIn}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-white/10 hover:bg-white/20 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleZoomOut}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-white/10 hover:bg-white/20 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleFullscreen}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-white/10 hover:bg-white/20 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          
          <button
            onClick={handleExport}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300' 
                : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
            }`}
            title="Export as Image"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={`p-4 border-b ${
        theme === 'dark' ? 'border-white/10' : 'border-gray-200'
      }`}>
        <div className="flex flex-wrap gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
          }`}>
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className={`text-xs ${
              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
            }`}>High Risk Customer</span>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
          }`}>
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className={`text-xs ${
              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
            }`}>Medium Risk Customer</span>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
          }`}>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className={`text-xs ${
              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
            }`}>Low Risk Customer</span>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
          }`}>
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className={`text-xs ${
              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
            }`}>Beneficiary</span>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
          }`}>
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className={`text-xs ${
              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
            }`}>Country</span>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
          }`}>
            <div className="w-3 h-3 rounded-full bg-pink-500"></div>
            <span className={`text-xs ${
              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
            }`}>Branch</span>
          </div>
        </div>
      </div>

      <div className="h-[600px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className={`w-12 h-12 animate-spin ${
              theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
            }`} />
            <p className={`mt-4 ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>Loading network data...</p>
          </div>
        ) : !graphData ? (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertCircle className={`w-12 h-12 ${
              theme === 'dark' ? 'text-red-400' : 'text-red-600'
            }`} />
            <p className={`mt-4 ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>No network data available</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeLabel={node => `${node.name} (${node.group})`}
            nodeColor={node => {
              const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
              return isHighlighted ? node.color || '#9333ea' : theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
            }}
            nodeRelSize={6}
            linkWidth={link => {
              const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(link);
              return isHighlighted ? 2 : 1;
            }}
            linkColor={link => {
              const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(link);
              return isHighlighted 
                ? theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'
                : theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
            }}
            onNodeClick={handleNodeClick}
            backgroundColor={theme === 'dark' ? '#1e1e2f' : '#f8fafc'}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={link => {
              const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(link);
              return isHighlighted ? 2 : 0;
            }}
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.name;
              const fontSize = 12/globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = theme === 'dark' ? 'white' : 'black';
              
              // Only show labels for highlighted nodes or when no highlighting is active
              if (highlightNodes.size === 0 || highlightNodes.has(node.id)) {
                ctx.fillText(label, node.x!, node.y! + 10);
              }
            }}
          />
        )}
      </div>
    </motion.div>
  );
};

export default NetworkGraphVisualization;
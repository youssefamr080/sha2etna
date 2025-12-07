import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import * as ShoppingService from '../services/ShoppingService';
import * as HapticService from '../services/hapticService';
import { ShoppingItem } from '../types';
import { Check, Plus, Trash2, Loader2 } from 'lucide-react';
import { getErrorMessage } from '../utils/errorHandler';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

const ShoppingPage: React.FC = () => {
  const { currentUser, group } = useApp();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!group?.id) return;
    const loadItems = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await ShoppingService.getShoppingList(group.id);
        setItems(data);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };
    loadItems();
  }, [group?.id]);

  const add = async () => {
    if(!newItemText.trim() || !currentUser || !group.id || isAdding) return;
    setIsAdding(true);
    const newItem: ShoppingItem = {
        id: Date.now().toString(),
        text: newItemText,
        addedBy: currentUser.id,
        groupId: group.id,
        completed: false
    };
    try {
      const created = await ShoppingService.addShoppingItem(newItem);
      setItems(prev => [created, ...prev]);
      setNewItemText('');
      HapticService.lightTap();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  };

  const toggle = async (id: string) => {
    if (!currentUser || processingItemId) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    setProcessingItemId(id);
    const updated = !item.completed;
    setItems(prev => prev.map(i => i.id === id ? { ...i, completed: updated } : i));
    HapticService.selectionChanged();
    try {
      await ShoppingService.toggleShoppingItem(id, updated, updated ? currentUser.id : undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      // Revert on error
      setItems(prev => prev.map(i => i.id === id ? { ...i, completed: !updated } : i));
    } finally {
      setProcessingItemId(null);
    }
  };

  const remove = async (id: string) => {
    if (processingItemId) return;
    setProcessingItemId(id);
    const itemToRemove = items.find(i => i.id === id);
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await ShoppingService.deleteShoppingItem(id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      // Revert on error
      if (itemToRemove) {
        setItems(prev => [...prev, itemToRemove]);
      }
    } finally {
      setProcessingItemId(null);
    }
  };

  return (
    <div className="p-5 min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">قائمة التسوق</h1>

        {errorMessage && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-200 px-4 py-2 rounded-lg">
            {errorMessage}
          </div>
        )}

        <div className="flex gap-2 mb-6">
            <input 
                type="text" 
                value={newItemText} 
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isAdding && add()}
                placeholder="إضافة غرض (مثلاً: حليب، صابون)..."
                disabled={isAdding}
                className="flex-1 border-none shadow-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-800 dark:text-white disabled:opacity-50"
            />
            <button 
                onClick={add} 
                disabled={!newItemText.trim() || isAdding} 
                className="bg-secondary text-white p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed min-w-[48px] flex items-center justify-center"
            >
                {isAdding ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
            </button>
        </div>

        <div className="space-y-2">
            {items.map(item => (
                <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm transition-all ${item.completed ? 'opacity-50' : ''} ${processingItemId === item.id ? 'opacity-70' : ''}`}>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => toggle(item.id)}
                            disabled={processingItemId !== null}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors disabled:cursor-not-allowed ${
                                item.completed ? 'bg-primary border-primary text-white' : 'border-gray-300 dark:border-gray-600'
                            }`}
                        >
                            {item.completed && <Check size={14} />}
                        </button>
                        <span className={`${item.completed ? 'line-through text-gray-400' : 'text-slate-800 dark:text-white font-medium'}`}>
                            {item.text}
                        </span>
                    </div>
                    <button 
                        onClick={() => remove(item.id)} 
                        disabled={processingItemId !== null}
                        className="text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}
             {items.length === 0 && !isLoading && (
               <EmptyState
                 icon="🛒"
                 title="الثلاجة مليانة!"
                 subtitle="ما نحتاج شيء حالياً. أضف أغراض جديدة من الأعلى."
               />
             )}
             {isLoading && (
               <div className="space-y-2">
                 {Array.from({ length: 4 }).map((_, idx) => (
                   <Skeleton key={idx} className="h-14" />
                 ))}
               </div>
             )}
        </div>
    </div>
  );
};

export default ShoppingPage;
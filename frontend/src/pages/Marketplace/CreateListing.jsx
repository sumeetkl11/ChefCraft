import { useState } from 'react';
import Navbar from '../../components/Navbar';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function CreateListing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);

    try {
      const response = await api.post('/marketplace/listings', payload);
      
      if (response.data?.success || response.status === 201) {
        toast.success('Listing created!');
        navigate('/marketplace');
      } else {
        toast.error('Failed to create listing');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-bg min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="glass-card p-8">
          <h2 className="text-2xl font-bold mb-6">List an Item</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input name="title" required className="w-full rounded-xl border border-slate-200 p-3" placeholder="e.g. Stand Mixer, Fresh Basil" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select name="category" className="w-full rounded-xl border border-slate-200 p-3">
                  <option value="equipment">Equipment</option>
                  <option value="ingredients">Ingredients</option>
                  <option value="cookbooks">Cookbooks</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price ($)</label>
                <input name="price" type="number" step="0.01" required className="w-full rounded-xl border border-slate-200 p-3" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Condition</label>
              <select name="condition" className="w-full rounded-xl border border-slate-200 p-3">
                <option value="new">Brand New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Image URL</label>
              <input name="image_url" type="url" className="w-full rounded-xl border border-slate-200 p-3" placeholder="https://..." />
            </div>
            
            <button disabled={loading} type="submit" className="cta-button w-full mt-6 py-4">
              {loading ? 'Publishing...' : 'Publish Listing'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

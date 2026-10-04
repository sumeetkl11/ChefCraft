import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { ImagePlus, NotebookPen, Share2, Sparkles, UploadCloud, X } from 'lucide-react';
import '../styles/CreatePost.css';

export default function CreatePost({ onPostCreated, buttonLabel = 'Create Post', allowImageOnly = false }) {
  const [showModal, setShowModal] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState('');
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showModal) {
      fetchUserRecipes();
    }
  }, [showModal]);

  useEffect(() => {
    if (!selectedRecipe) {
      return;
    }

    const recipe = recipes.find((item) => String(item.id) === String(selectedRecipe));
    if (recipe?.image_url && !uploadedImageUrl && !imageUrl) {
      setImagePreview(recipe.image_url);
    }
  }, [selectedRecipe, recipes, uploadedImageUrl, imageUrl]);

  useEffect(() => {
    if (!showModal) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowModal(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal]);

  const fetchUserRecipes = async () => {
    try {
      const response = await api.get('/recipes');
      if (response.data?.success) {
        const list = response.data?.data?.recipes || response.data?.data || [];
        setRecipes(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error('Error fetching recipes:', err);
      setRecipes([]);
    }
  };

  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }

    const maxSizeInBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      toast.error('Please choose an image smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setUploadedImageUrl(typeof dataUrl === 'string' ? dataUrl : '');
      setImagePreview(typeof dataUrl === 'string' ? dataUrl : '');
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageUrl('');
    setUploadedImageUrl('');
    setImagePreview('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if ((!allowImageOnly && !selectedRecipe) || !caption.trim()) {
      toast.error(allowImageOnly ? 'Please add a caption' : 'Please select a recipe and add a caption');
      return;
    }

    try {
      const recipe = recipes.find((item) => String(item.id) === String(selectedRecipe));
      const finalImageUrl = uploadedImageUrl || imageUrl.trim() || recipe?.image_url || '';

      if (allowImageOnly && !selectedRecipe && !finalImageUrl) {
        toast.error('Please upload an image or paste an image URL');
        return;
      }

      setLoading(true);
      const response = await api.post('/posts', {
        recipeId: selectedRecipe || null,
        caption,
        imageUrl: finalImageUrl
      });

      if (response.data?.success || response.status === 201) {
        const postData = response.data?.data;
        onPostCreated(postData);
        setShowModal(false);
        setSelectedRecipe('');
        setCaption('');
        setImageUrl('');
        setUploadedImageUrl('');
        setImagePreview('');
        toast.success('Post created successfully!');
      } else {
        toast.error('Failed to create post');
      }
    } catch (err) {
      console.error('Error creating post:', err);
      toast.error('Error creating post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="create-post-btn" onClick={() => setShowModal(true)}>
        <Sparkles className="h-4 w-4" />
        {buttonLabel}
      </button>

      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowModal(false)}>
              ✕
            </button>

            <div className="modal-header">
              <div className="modal-badge">
                <Share2 className="h-4 w-4" />
                Social share
              </div>
              <h2>Create a Post</h2>
              <p>{allowImageOnly ? 'Upload a picture, add a caption, and publish it to your profile and social feed.' : 'Choose one of your saved recipes, add a quick story, and publish it to your feed.'}</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="recipe">Select Recipe {allowImageOnly && <span className="optional-label">Optional</span>}</label>
                <select
                  id="recipe"
                  value={selectedRecipe}
                  onChange={(event) => setSelectedRecipe(event.target.value)}
                  required={!allowImageOnly}
                >
                  <option value="">-- Choose a recipe --</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
                {recipes.length === 0 && (
                  <p className="field-hint">Starter recipes are added automatically. Refresh if they have not appeared yet.</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="caption">
                  <NotebookPen className="h-4 w-4" />
                  Caption
                </label>
                <textarea
                  id="caption"
                  placeholder="Share your thoughts about this recipe..."
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  rows="4"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="imageUrl">
                  <ImagePlus className="h-4 w-4" />
                  Image URL
                </label>
                <input
                  id="imageUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(event) => {
                    setImageUrl(event.target.value);
                    setImagePreview(event.target.value);
                  }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="imageFile">
                  <UploadCloud className="h-4 w-4" />
                  Upload image
                </label>
                <input
                  id="imageFile"
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                />
                <p className="field-hint">Local uploads are stored with the post preview. Use images under 2MB.</p>
              </div>

              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Post preview" loading="eager" decoding="async" />
                  <button type="button" onClick={clearImage}>
                    <X className="h-4 w-4" />
                    Remove image
                  </button>
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Posting...' : 'Publish Post'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

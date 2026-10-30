import { createRoot } from 'react-dom/client';
import '../../src/styles/globals.css';
import { PrimitivesGallery } from '../../src/ui/PrimitivesGallery';

const root = document.getElementById('root');
if (!root) throw new Error('Missing fixture root');
createRoot(root).render(<PrimitivesGallery />);

// frontend/src/components/ModalPortal.jsx — render dialogs at <body> level
// Pages animate with CSS transforms, and a transformed ancestor becomes the containing block
// for position:fixed children; a portal keeps every dialog relative to the screen and above
// the sticky header.
import { createPortal } from 'react-dom';

export default function ModalPortal({ children }) {
  return createPortal(children, document.body);
}

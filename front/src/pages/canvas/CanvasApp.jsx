import Sidebar from './panels/Sidebar';
import Canvas from './Canvas';
import styles from './Canvas.module.css';
import PropertiesPanel from './panels/PropertiesPanel';

const CanvasApp = () => {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <Canvas />
      <PropertiesPanel />
    </div>
  );
};

export default CanvasApp;

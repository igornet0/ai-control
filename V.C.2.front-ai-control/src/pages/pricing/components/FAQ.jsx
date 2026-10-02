import React, { useEffect, useState } from 'react';
import FAQItem from './FAQItem';
import styles from './FAQItem.module.css';

const FAQ = ({ title, items, customerType }) => {
  const [openId, setOpenId] = useState(items[0]?.id ?? null);

  useEffect(() => {
    setOpenId(items[0]?.id ?? null);
  }, [customerType]); // eslint-disable-line react-hooks/exhaustive-deps -- reset accordion when audience changes

  return (
    <section className={styles.section} aria-labelledby="faq-title" key={customerType}>
      <h2 id="faq-title" className={styles.title}>
        {title}
      </h2>
      <div className={styles.list}>
        {items.map((item) => (
          <FAQItem
            key={item.id}
            item={item}
            isOpen={openId === item.id}
            onToggle={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
          />
        ))}
      </div>
    </section>
  );
};

export default FAQ;

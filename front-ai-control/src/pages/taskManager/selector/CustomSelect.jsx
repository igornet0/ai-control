import React, { useState, useRef, useEffect } from "react";

function CustomSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Закрытие по клику вне компонента
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-[#0f1b16] border border-gray-600 rounded-md px-3 py-2 text-left text-white flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        <span>{value}</span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {open && (
        <ul style={{ gap: 0}} 
        className="absolute w-full overflow-auto rounded-md bg-[#16251C] border border-gray-700 text-white shadow-lg flex flex-col">
          {options.map((opt) => (
            <li
              key={opt}
              onClick={() => handleSelect(opt)}
              className={`cursor-pointer px-4 py-2 hover:bg-green-600 ${
                opt === value ? "bg-green-700 font-semibold" : ""
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CustomSelect;
import { useLayoutEffect, useRef } from 'react';

export function ClinicalNotes(props) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const input = ref.current;
    const fitContent = () => {
      input.style.height = '0px';
      input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`;
    };
    fitContent();
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== width) {
        width = input.clientWidth;
        fitContent();
      }
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [props.value]);
  return <textarea ref={ref} {...props}/>;
}


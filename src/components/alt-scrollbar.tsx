import React, {useState, useEffect, useRef, useCallback} from 'react';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';

const AlternativeScrollbar = ({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef = useRef<HTMLDivElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [thumbHeight, setThumbHeight] = useState(20);
  const [scrollStartPosition, setScrollStartPosition] = useState<number>(0);

  // Number of pixels that an element's content is scrolled vertically.
  const [initialScrollTop, setInitialScrollTop] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  function handleResize(ref: HTMLDivElement, trackSize: number) {
    const {clientHeight, scrollHeight} = ref;
    setThumbHeight(Math.max((clientHeight / scrollHeight) * trackSize));
  }

  function handleScrollButton(direction: 'up' | 'down') {
    const {current} = contentRef;
    if (current) {
      const scrollAmount = direction === 'down' ? 200 : -200;
      current.scrollBy({top: scrollAmount, behavior: 'smooth'});
    }
  }

  const handleTrackClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const {current: trackCurrent} = scrollTrackRef;
      const {current: contentCurrent} = contentRef;
      if (trackCurrent && contentCurrent) {
        const {clientY} = event;
        const target = event.target as HTMLDivElement;
        const rect = target.getBoundingClientRect();
        const trackTop = rect.top;
        const thumbOffset = -(thumbHeight / 2);
        const clickRatio =
          (clientY - trackTop + thumbOffset) / trackCurrent.clientHeight;
        const scrollAmount = Math.floor(
          clickRatio * contentCurrent.scrollHeight
        );
        contentCurrent.scrollTo({
          top: scrollAmount,
          behavior: 'smooth',
        });
      }
    },
    [thumbHeight]
  );

  const handleThumbPosition = useCallback(() => {
    if (
      !contentRef.current ||
      !scrollTrackRef.current ||
      !scrollThumbRef.current
    ) {
      return;
    }
    const {scrollTop: contentTop, scrollHeight: contentHeight} =
      contentRef.current;
    const {clientHeight: trackHeight} = scrollTrackRef.current;
    let newTop = (+contentTop / +contentHeight) * trackHeight;
    newTop = Math.min(newTop, trackHeight - thumbHeight);
    const thumb = scrollThumbRef.current;
    thumb.style.top = `${newTop}px`;
  }, []);

  const handleThumbMousedown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setScrollStartPosition(event.clientY);
      if (contentRef.current) setInitialScrollTop(contentRef.current.scrollTop);
      setIsDragging(true);
    },
    []
  );

  const handleThumbMouseup = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isDragging) {
        setIsDragging(false);
      }
    },
    [isDragging]
  );

  const handleThumbMousemove = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (isDragging && contentRef.current) {
        const {
          scrollHeight: contentScrollHeight,
          offsetHeight: contentOffsetHeight,
        } = contentRef.current;
        const deltaY =
          (event.clientY - scrollStartPosition) *
          (contentOffsetHeight / thumbHeight);
        const newScrollTop = Math.min(
          initialScrollTop + deltaY,
          contentScrollHeight - contentOffsetHeight
        );
        contentRef.current.scrollTop = newScrollTop;
      }
    },
    [initialScrollTop, isDragging, scrollStartPosition, thumbHeight]
  );

  // If the content and the scrollbar track exist, use a ResizeObserver to adjust height of thumb and listen for scroll event to move the thumb
  useEffect(() => {
    if (contentRef.current && scrollTrackRef.current) {
      const ref = contentRef.current;
      const {clientHeight: trackSize} = scrollTrackRef.current;
      observer.current = new ResizeObserver(() => {
        handleResize(ref, trackSize);
      });
      observer.current.observe(ref);
      ref.addEventListener('scroll', handleThumbPosition);
      return () => {
        observer.current?.unobserve(ref);
        ref.removeEventListener('scroll', handleThumbPosition);
      };
    }
  }, []);

  // Listen for mouse events to handle scrolling by dragging the thumb
  useEffect(() => {
    document.addEventListener('mousemove', handleThumbMousemove);
    document.addEventListener('mouseup', handleThumbMouseup);
    document.addEventListener('mouseleave', handleThumbMouseup);
    return () => {
      document.removeEventListener('mousemove', handleThumbMousemove);
      document.removeEventListener('mouseup', handleThumbMouseup);
      document.removeEventListener('mouseleave', handleThumbMouseup);
    };
  }, [handleThumbMousemove, handleThumbMouseup]);

  return (
    <div className="custom-scrollbars__container">
      <div className="custom-scrollbars__scrollbar">
        <IconButton
          className="custom-scrollbars__button"
          onClick={() => handleScrollButton('up')}
        >
          <KeyboardArrowUp />
        </IconButton>
        <div className="custom-scrollbars__track-and-thumb">
          <div
            className="custom-scrollbars__track"
            ref={scrollTrackRef}
            onClick={handleTrackClick}
            style={{cursor: isDragging ? 'grabbing' : 'grab'}}
          ></div>
          <div
            className="custom-scrollbars__thumb"
            ref={scrollThumbRef}
            onMouseDown={handleThumbMousedown}
            style={{
              height: `${thumbHeight}px`,
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
          ></div>
        </div>
        <IconButton
          className="custom-scrollbars__button"
          onClick={() => handleScrollButton('down')}
        >
          <KeyboardArrowDown />
        </IconButton>
      </div>
      <div className="custom-scrollbars__content" ref={contentRef} {...props}>
        {children}
      </div>
    </div>
  );
};

export default AlternativeScrollbar;

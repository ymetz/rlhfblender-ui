import React, { useState, useEffect, useRef, useCallback } from "react";
import IconButton from "@mui/material/IconButton";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import { useTheme } from "@mui/material/styles";
import { styled } from "@mui/system";
import { useSetupConfigState } from "../../SetupConfigContext";

// Custom styles
interface ScrollbarStyledProps extends React.ComponentPropsWithoutRef<"div"> {
  horizontalRanking: boolean;
}

const ScrollbarContainer = styled("div")<ScrollbarStyledProps>(
  ({ theme, horizontalRanking }) => ({
    display: "flex",
    flexDirection: horizontalRanking ? "column" : "row",
    backgroundColor: theme.palette.background?.l1,
    height: "100%",
    width: "100%",
  }),
);

const ScrollbarContentContainer = styled("div")<ScrollbarStyledProps>(
  ({ theme, horizontalRanking }) => ({
    display: "flex",
    flexDirection: horizontalRanking ? "row" : "column",
    backgroundColor: theme.palette.background?.l0,
    border: `1px solid ${theme.palette.divider}`,
    msOverflowStyle: "none",
    overflowY: "auto",
    padding: "0 1rem",
    flex: 1,
    scrollbarWidth: "none",
  }),
);

const ScrollbarMain = styled("div")<ScrollbarStyledProps>(
  ({ theme, horizontalRanking }) => ({
    display: "grid",
    gap: "1rem",
    gridAutoFlow: "row",
    padding: "1rem",
    placeItems: "center",
    gridTemplate: horizontalRanking
      ? "1fr / auto 1fr auto"
      : "auto 1fr auto / 1fr",
  }),
);

const TrackAndThumb = styled("div")<ScrollbarStyledProps>(
  ({ horizontalRanking }) => ({
    display: "block",
    position: "relative",
    height: horizontalRanking ? "1vw" : "100%",
    width: horizontalRanking ? "100%" : "1vw",
  }),
);

const Track = styled("div")<ScrollbarStyledProps>(
  ({ theme, horizontalRanking }) => ({
    backgroundColor: theme.palette.background?.l0,
    borderRadius: "12px",
    bottom: 0,
    left: 0,
    top: 0,
    right: 0,
    cursor: "pointer",
    position: "absolute",
    width: horizontalRanking ? "auto" : "1vw",
    border: `1px solid ${theme.palette?.divider}`,
  }),
);

const Thumb = styled("div")<ScrollbarStyledProps>(
  ({ theme, horizontalRanking }) => ({
    borderRadius: "12px",
    backgroundColor: theme.palette.text.secondary,
    position: "absolute",
    height: horizontalRanking ? "1vw" : "16px",
    width: horizontalRanking ? "16px" : "1vw",
  }),
);

const Scrollbar: React.FC<React.ComponentPropsWithoutRef<"div">> = ({
  children,
  className,
  ...props
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef = useRef<HTMLDivElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [thumbHeight, setThumbHeight] = useState(20);
  const [thumbWidth, setThumbWidth] = useState(20);
  const [scrollStartPositionY, setScrollStartPositionY] = useState<number>(0);
  const [scrollStartPositionX, setScrollStartPositionX] = useState<number>(0);
  const setupConfigState = useSetupConfigState();
  const horizontalRanking =
    setupConfigState.activeUIConfig.uiComponents.horizontalRanking;
  const theme = useTheme();

  // Number of pixels that an element's content is scrolled vertically.
  const [initialScrollTop, setInitialScrollTop] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  function handleScrollButton(direction: "up" | "down") {
    const { current } = contentRef;
    if (current) {
      const scrollAmount = direction === "down" ? 200 : -200;
      if (horizontalRanking) {
        current.scrollBy({ left: scrollAmount, behavior: "smooth" });
      } else {
        current.scrollBy({ top: scrollAmount, behavior: "smooth" });
      }
    }
  }

  const handleClickOnTrack = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const { current: trackCurrent } = scrollTrackRef;
      const { current: contentCurrent } = contentRef;
      if (trackCurrent && contentCurrent) {
        const { clientY, clientX } = event;
        const target = event.target as HTMLDivElement;
        const rect = target.getBoundingClientRect();
        let scrollAmount = 0;
        if (horizontalRanking) {
          const trackLeft = rect.left;
          const thumbOffset = -(thumbWidth / 2);
          const clickRatio =
            (clientX - trackLeft + thumbOffset) / trackCurrent.clientWidth;
          scrollAmount = Math.floor(clickRatio * contentCurrent.scrollWidth);
        } else {
          const trackTop = rect.top;
          const thumbOffset = -(thumbHeight / 2);
          const clickRatio =
            (clientY - trackTop + thumbOffset) / trackCurrent.clientHeight;
          scrollAmount = Math.floor(clickRatio * contentCurrent.scrollHeight);
        }
        if (horizontalRanking) {
          contentCurrent.scrollTo({
            left: scrollAmount,
            behavior: "smooth",
          });
        } else {
          contentCurrent.scrollTo({
            top: scrollAmount,
            behavior: "smooth",
          });
        }
      }
    },
    [thumbHeight, thumbWidth, horizontalRanking],
  );

  const handleThumbPosition = useCallback(() => {
    if (
      !contentRef.current ||
      !scrollTrackRef.current ||
      !scrollThumbRef.current
    ) {
      return;
    }
    const thumb = scrollThumbRef.current;
    if (horizontalRanking) {
      const { scrollLeft: contentLeft, scrollWidth: contentWidth } =
        contentRef.current;
      const { clientWidth: trackWidth } = scrollTrackRef.current;
      let newLeft = (+contentLeft / +contentWidth) * trackWidth;
      newLeft = Math.min(newLeft, trackWidth - thumbWidth);
      thumb.style.left = `${newLeft}px`;
    } else {
      const { scrollTop: contentTop, scrollHeight: contentHeight } =
        contentRef.current;
      const { clientHeight: trackHeight } = scrollTrackRef.current;
      let newTop = (+contentTop / +contentHeight) * trackHeight;
      newTop = Math.min(newTop, trackHeight - thumbHeight);
      thumb.style.top = `${newTop}px`;
    }
  }, [horizontalRanking, thumbHeight, thumbWidth]);

  const handleThumbMousedown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setScrollStartPositionY(event.clientY);
      setScrollStartPositionX(event.clientX);
      if (contentRef.current) {
        if (horizontalRanking) {
          setInitialScrollTop(contentRef.current.scrollLeft);
        } else {
          setInitialScrollTop(contentRef.current.scrollTop);
        }
      }
      setIsDragging(true);
    },
    [horizontalRanking],
  );

  const handleThumbMouseup = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isDragging) {
        setIsDragging(false);
      }
    },
    [isDragging],
  );

  useEffect(() => {
    if (!scrollThumbRef.current) {
      return;
    }
    const thumb = scrollThumbRef.current;
    if (horizontalRanking) {
      thumb.style.top = "0px";
    } else {
      thumb.style.left = "0px";
    }
  }, [horizontalRanking]);

  const handleThumbMousemove = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (isDragging && contentRef.current) {
        if (horizontalRanking) {
          const {
            scrollWidth: contentScrollWidth,
            offsetWidth: contentOffsetWidth,
          } = contentRef.current;
          const deltaX =
            (event.clientX - scrollStartPositionX) *
            (contentOffsetWidth / thumbWidth);
          const newScrollLeft = Math.min(
            initialScrollTop + deltaX,
            contentScrollWidth - contentOffsetWidth,
          );
          contentRef.current.scrollLeft = newScrollLeft;
        } else {
          const {
            scrollHeight: contentScrollHeight,
            offsetHeight: contentOffsetHeight,
          } = contentRef.current;
          const deltaY =
            (event.clientY - scrollStartPositionY) *
            (contentOffsetHeight / thumbHeight);
          const newScrollTop = Math.min(
            initialScrollTop + deltaY,
            contentScrollHeight - contentOffsetHeight,
          );
          contentRef.current.scrollTop = newScrollTop;
        }
      }
    },
    [
      initialScrollTop,
      isDragging,
      scrollStartPositionY,
      thumbHeight,
      thumbWidth,
      horizontalRanking,
      scrollStartPositionX,
    ],
  );

  // If the content and the scrollbar track exist, use a ResizeObserver to adjust height of thumb and listen for scroll event to move the thumb
  useEffect(() => {
    if (contentRef.current && scrollTrackRef.current) {
      const ref = contentRef.current;
      const { clientHeight: trackHeight } = scrollTrackRef.current;
      const { clientWidth: trackWidth } = scrollTrackRef.current;
      observer.current = new ResizeObserver(() => {
        const { clientHeight, scrollHeight, clientWidth, scrollWidth } = ref;
        if (horizontalRanking) {
          setThumbWidth(Math.max((clientWidth / scrollWidth) * trackWidth));
          setThumbHeight(window.innerWidth / 100.0);
        } else {
          setThumbHeight(Math.max((clientHeight / scrollHeight) * trackHeight));
          setThumbWidth(window.innerWidth / 100.0);
        }
      });
      observer.current.observe(ref);
      ref.addEventListener("scroll", handleThumbPosition);
      return () => {
        observer.current?.unobserve(ref);
        ref.removeEventListener("scroll", handleThumbPosition);
      };
    }
  }, [handleThumbPosition, horizontalRanking]);

  // Listen for mouse events to handle scrolling by dragging the thumb
  useEffect(() => {
    document.addEventListener("mousemove", handleThumbMousemove);
    document.addEventListener("mouseup", handleThumbMouseup);
    document.addEventListener("mouseleave", handleThumbMouseup);
    return () => {
      document.removeEventListener("mousemove", handleThumbMousemove);
      document.removeEventListener("mouseup", handleThumbMouseup);
      document.removeEventListener("mouseleave", handleThumbMouseup);
    };
  }, [handleThumbMousemove, handleThumbMouseup]);

  return (
    <ScrollbarContainer horizontalRanking={horizontalRanking}>
      <ScrollbarMain horizontalRanking={horizontalRanking}>
        <IconButton onClick={() => handleScrollButton("up")}>
          {horizontalRanking ? (
            <KeyboardArrowLeft sx={{ color: theme.palette.text.secondary }} />
          ) : (
            <KeyboardArrowUp sx={{ color: theme.palette.text.secondary }} />
          )}
        </IconButton>
        <TrackAndThumb horizontalRanking={horizontalRanking}>
          <Track
            horizontalRanking={horizontalRanking}
            ref={scrollTrackRef}
            onClick={handleClickOnTrack}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
          ></Track>
          <Thumb
            horizontalRanking={horizontalRanking}
            ref={scrollThumbRef}
            onMouseDown={handleThumbMousedown}
            style={{
              height: `${thumbHeight}px`,
              width: `${thumbWidth}px`,
              cursor: isDragging ? "grabbing" : "grab",
            }}
          ></Thumb>
        </TrackAndThumb>
        <IconButton onClick={() => handleScrollButton("down")}>
          {horizontalRanking ? (
            <KeyboardArrowRight sx={{ color: theme.palette.text.secondary }} />
          ) : (
            <KeyboardArrowDown sx={{ color: theme.palette.text.secondary }} />
          )}
        </IconButton>
      </ScrollbarMain>
      <ScrollbarContentContainer
        ref={contentRef}
        horizontalRanking={horizontalRanking}
        {...props}
      >
        {children}
      </ScrollbarContentContainer>
    </ScrollbarContainer>
  );
};

export default Scrollbar;

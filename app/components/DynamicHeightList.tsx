import React, { useRef } from "react";
import { FixedSizeList as List } from "react-window";
import { Box, Checkbox, Typography, IconButton } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useResizeObserver } from "@/hooks/useResizeObserver";

interface DynamicHeightListProps {
  items: string[];
  handlePlayMessage: (message: string) => void;
}

const DynamicHeightList: React.FC<DynamicHeightListProps> = ({
  items,
  handlePlayMessage,
}) => {
  const listContainerRef = useRef<HTMLDivElement>(null);
  const { height } = useResizeObserver(listContainerRef);
  console.log("height",height)

  return (
    <div
      ref={listContainerRef}
      style={{ flex: 1, minHeight: "100px", height: "100%" }}
    >
      {height > 0 && (
        <List
          height={height}
          itemCount={items.length}
          itemSize={50}
          width="100%"
          itemData={items}
        >
          {({ index, style }) => (
            <Box
              style={style}
              sx={{
                display: "flex",
                alignItems: "center",
                height: "50px",
                bgcolor: index % 2 ? "action.hover" : "background.paper",
              }}
            >
              <Typography
                noWrap
                sx={{
                  flexGrow: 1,
                  color: index % 2 ? "secondary.main" : "primary.main",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {items[index]}
              </Typography>
              <IconButton
                onClick={() => handlePlayMessage(items[index])}
                color="primary"
                size="small"
                sx={{mr:1.5}}
              >
                <PlayArrowIcon />
              </IconButton>
            </Box>
          )}
        </List>
      )}
    </div>
  );
};

export default DynamicHeightList;

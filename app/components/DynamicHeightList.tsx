import React, { useRef, useState } from "react";
import { FixedSizeList as List } from "react-window";
import {
  Box,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useResizeObserver } from "@/hooks/useResizeObserver";

interface DynamicHeightListProps {
  items: string[];
  handlePlayMessage: (message: string) => void;
  handleEditMessage: (index: number, newText: string) => void;
  dictionary: any;
}

const DynamicHeightList: React.FC<DynamicHeightListProps> = ({
  items,
  handlePlayMessage,
  handleEditMessage,
  dictionary,
}) => {
  const listContainerRef = useRef<HTMLDivElement>(null);
  const { height } = useResizeObserver(listContainerRef);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentText, setCurrentText] = useState<string>("");

  const handleEditClick = (index: number, text: string) => {
    setEditingIndex(index);
    setCurrentText(text);
  };

  const handleSaveClick = () => {
    if (editingIndex !== null) {
      handleEditMessage(editingIndex, currentText);
      setEditingIndex(null);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentText(event.target.value);
  };

  const handleClose = () => {
    setEditingIndex(null);
  };

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
                onClick={() => handleEditClick(index, items[index])}
              >
                {items[index]}
              </Typography>
              <IconButton
                onClick={() => handlePlayMessage(items[index])}
                color="primary"
                size="small"
                sx={{ mr: 1.5 }}
              >
                <PlayArrowIcon />
              </IconButton>
            </Box>
          )}
        </List>
      )}

      <Dialog
        open={editingIndex !== null}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        sx={{
          "& .MuiDialog-paper": {
            width: "100%",
            maxWidth: "50rem",
            m: 1,
          },
        }}
      >
        <DialogTitle>{dictionary.edit}</DialogTitle>
        <DialogContent>
          <TextField
            value={currentText}
            onChange={handleChange}
            fullWidth
            multiline
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            {dictionary.cancel}
          </Button>
          <Button onClick={handleSaveClick} color="primary">
            {dictionary.save}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default DynamicHeightList;
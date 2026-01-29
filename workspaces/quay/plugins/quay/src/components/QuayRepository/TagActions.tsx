/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Chip,
  Box,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import AddIcon from '@material-ui/icons/Add';
import LabelIcon from '@material-ui/icons/Label';
import DeleteIcon from '@material-ui/icons/Delete';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { quayApiRef } from '../../api';
import type { Label, QuayTagData } from '../../types';

const useStyles = makeStyles(theme => ({
  addIcon: { color: theme.palette.success.main },
  labelIcon: { color: theme.palette.info.main },
  deleteIcon: { color: theme.palette.error.main },
  deleteMenuItem: { color: theme.palette.error.main },
  labelChip: { margin: theme.spacing(0.5) },
  labelContainer: { marginTop: theme.spacing(2), marginBottom: theme.spacing(2) },
  labelInputRow: { display: 'flex', gap: theme.spacing(1), marginTop: theme.spacing(2) },
  labelInput: { flex: 1 },
}));

interface TagActionsProps {
  rowData: QuayTagData;
  instanceName: string | undefined;
  organization: string;
  repository: string;
  onRefresh: () => void;
}

export function TagActions({
  rowData,
  instanceName,
  organization,
  repository,
  onRefresh,
}: TagActionsProps) {
  const classes = useStyles();
  const quayApi = useApi(quayApiRef);
  const alertApi = useApi(alertApiRef);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [labels, setLabels] = useState<Label[]>([]);
  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelValue, setNewLabelValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [labelsLoading, setLabelsLoading] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAddTagOpen = () => {
    handleMenuClose();
    setNewTagName('');
    setAddTagOpen(true);
  };

  const handleLabelsOpen = async () => {
    handleMenuClose();
    setLabelsOpen(true);
    setLabelsLoading(true);
    try {
      const response = await quayApi.getLabels(
        instanceName,
        organization,
        repository,
        rowData.manifest_digest_raw,
      );
      setLabels(response.labels || []);
    } catch (error) {
      alertApi.post({ message: `Failed to load labels: ${error}`, severity: 'error' });
    } finally {
      setLabelsLoading(false);
    }
  };

  const handleDeleteOpen = () => {
    handleMenuClose();
    setDeleteOpen(true);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setLoading(true);
    try {
      await quayApi.createTag(
        instanceName,
        organization,
        repository,
        newTagName.trim(),
        rowData.manifest_digest_raw,
      );
      alertApi.post({ message: `Tag "${newTagName}" created successfully`, severity: 'success' });
      setAddTagOpen(false);
      onRefresh();
    } catch (error) {
      alertApi.post({ message: `Failed to create tag: ${error}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async () => {
    setLoading(true);
    try {
      await quayApi.deleteTag(instanceName, organization, repository, rowData.name);
      alertApi.post({ message: `Tag "${rowData.name}" deleted successfully`, severity: 'success' });
      setDeleteOpen(false);
      onRefresh();
    } catch (error) {
      alertApi.post({ message: `Failed to delete tag: ${error}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddLabel = async () => {
    if (!newLabelKey.trim() || !newLabelValue.trim()) return;
    setLoading(true);
    try {
      const label = await quayApi.addLabel(
        instanceName,
        organization,
        repository,
        rowData.manifest_digest_raw,
        newLabelKey.trim(),
        newLabelValue.trim(),
      );
      setLabels([...labels, label]);
      setNewLabelKey('');
      setNewLabelValue('');
      alertApi.post({ message: 'Label added successfully', severity: 'success' });
    } catch (error) {
      alertApi.post({ message: `Failed to add label: ${error}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    try {
      await quayApi.deleteLabel(
        instanceName,
        organization,
        repository,
        rowData.manifest_digest_raw,
        labelId,
      );
      setLabels(labels.filter(l => l.id !== labelId));
      alertApi.post({ message: 'Label deleted', severity: 'success' });
    } catch (error) {
      alertApi.post({ message: `Failed to delete label: ${error}`, severity: 'error' });
    }
  };

  return (
    <>
      <IconButton size="small" onClick={handleMenuOpen}>
        <MoreVertIcon />
      </IconButton>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleAddTagOpen}>
          <ListItemIcon><AddIcon className={classes.addIcon} /></ListItemIcon>
          <ListItemText primary="Add New Tag" />
        </MenuItem>
        <MenuItem onClick={handleLabelsOpen}>
          <ListItemIcon><LabelIcon className={classes.labelIcon} /></ListItemIcon>
          <ListItemText primary="Edit Labels" />
        </MenuItem>
        <MenuItem onClick={handleDeleteOpen} className={classes.deleteMenuItem}>
          <ListItemIcon><DeleteIcon className={classes.deleteIcon} /></ListItemIcon>
          <ListItemText primary="Delete Tag" />
        </MenuItem>
      </Menu>

      {/* Add Tag Dialog */}
      <Dialog open={addTagOpen} onClose={() => setAddTagOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Tag</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Create a new tag pointing to the same image as <strong>{rowData.name}</strong>
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="New Tag Name"
            fullWidth
            variant="outlined"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            placeholder="e.g., v1.0.0, prod, stable"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddTagOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateTag} color="primary" variant="contained" disabled={loading || !newTagName.trim()}>
            {loading ? <CircularProgress size={20} /> : 'Create Tag'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Labels Dialog */}
      <Dialog open={labelsOpen} onClose={() => setLabelsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Labels for {rowData.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary">
            Labels are key-value pairs attached to the image manifest.
          </Typography>
          <Box className={classes.labelContainer}>
            {labelsLoading ? (
              <CircularProgress size={24} />
            ) : labels.length === 0 ? (
              <Typography variant="body2" color="textSecondary"><em>No labels</em></Typography>
            ) : (
              labels.map(label => (
                <Chip
                  key={label.id}
                  label={`${label.key}=${label.value}`}
                  onDelete={() => handleDeleteLabel(label.id)}
                  className={classes.labelChip}
                  variant="outlined"
                />
              ))
            )}
          </Box>
          <Box className={classes.labelInputRow}>
            <TextField
              className={classes.labelInput}
              label="Key"
              variant="outlined"
              size="small"
              value={newLabelKey}
              onChange={e => setNewLabelKey(e.target.value)}
            />
            <TextField
              className={classes.labelInput}
              label="Value"
              variant="outlined"
              size="small"
              value={newLabelValue}
              onChange={e => setNewLabelValue(e.target.value)}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleAddLabel}
              disabled={loading || !newLabelKey.trim() || !newLabelValue.trim()}
            >
              Add
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLabelsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Tag</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete tag <strong>{rowData.name}</strong>?
          </Typography>
          <Typography variant="body2" color="error">
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteTag} color="secondary" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

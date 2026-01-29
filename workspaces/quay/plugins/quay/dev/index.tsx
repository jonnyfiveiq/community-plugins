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
import '@backstage/ui/css/styles.css';

import { Entity } from '@backstage/catalog-model';
import { createDevApp } from '@backstage/dev-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { mockApis, TestApiProvider } from '@backstage/test-utils';

import { quayApiRef, QuayApiV1, QuayInstanceConfig } from '../src/api';
import { QuayPage, quayPlugin } from '../src/plugin';
import { labels } from './__data__/labels';
import { manifestDigest } from './__data__/manifest_digest';
import {
  securityDetails,
  v1securityDetails,
  v2securityDetails,
  v3securityDetails,
  v4securityDetails,
} from './__data__/security_vulnerabilities';
import { tags } from './__data__/tags';
import { Label } from '../src/types';

const mockEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'backstage',
    description: 'backstage.io',
    annotations: {
      'quay.io/repository-slug': 'backstage-test/test-images',
    },
  },
  spec: {
    lifecycle: 'production',
    type: 'service',
    owner: 'user:guest',
  },
};

export class MockQuayApiClient implements QuayApiV1 {
  getQuayInstance(_?: string): QuayInstanceConfig | undefined {
    return { name: 'default', apiUrl: 'https://quay.io' };
  }

  async getTags() {
    return tags;
  }

  async getLabels() {
    return labels;
  }

  async getManifestByDigest() {
    return manifestDigest;
  }

  async getSecurityDetails(_: string, __: string, ___: string, digest: string) {
    if (
      digest ===
      'sha256:79c96c750aa532d92d9cb56cad59159b7cc26b10e39ff4a895c28345d2cd775d'
    ) {
      return v3securityDetails;
    }

    if (
      digest ===
      'sha256:89c96c750aa532d92d9cb56cad59159b7cc26b10e39ff4a895c28345d2cd775e'
    ) {
      return v2securityDetails;
    }
    if (
      digest ===
      'sha256:99c96c750aa532d92d9cb56cad59159b7cc26b10e39ff4a895c28345d2cd775f'
    ) {
      return v1securityDetails;
    }

    if (
      digest ===
      'sha256:29c96c750aa532d92d9cb56cad59159b7cc26b10e39ff4a895c28345d2cd775d'
    ) {
      return v4securityDetails;
    }

    return securityDetails;
  }

  // Write operations (mock implementations)
  async createTag(
    _instanceName: string | undefined,
    _org: string,
    _repo: string,
    _tag: string,
    _manifestDigest: string,
  ): Promise<void> {
    // Mock implementation - does nothing
    console.log('Mock: createTag called');
  }

  async deleteTag(
    _instanceName: string | undefined,
    _org: string,
    _repo: string,
    _tag: string,
  ): Promise<void> {
    // Mock implementation - does nothing
    console.log('Mock: deleteTag called');
  }

  async addLabel(
    _instanceName: string | undefined,
    _org: string,
    _repo: string,
    _manifestDigest: string,
    key: string,
    value: string,
    _mediaType?: string,
  ): Promise<Label> {
    // Mock implementation - returns a fake label
    console.log('Mock: addLabel called');
    return {
      id: 'mock-label-id',
      key,
      value,
      source_type: 'api',
      media_type: 'text/plain',
    };
  }

  async deleteLabel(
    _instanceName: string | undefined,
    _org: string,
    _repo: string,
    _manifestDigest: string,
    _labelId: string,
  ): Promise<void> {
    // Mock implementation - does nothing
    console.log('Mock: deleteLabel called');
  }
}

createDevApp()
  .registerPlugin(quayPlugin)
  .addPage({
    element: (
      <TestApiProvider
        apis={[
          [quayApiRef, new MockQuayApiClient()],
          [permissionApiRef, mockApis.permission()],
        ]}
      >
        <EntityProvider entity={mockEntity}>
          <QuayPage />
        </EntityProvider>
      </TestApiProvider>
    ),
    title: 'Root Page',
    path: '/quay',
  })
  .render();

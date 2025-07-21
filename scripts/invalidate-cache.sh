#!/bin/bash

# Script para invalidar la caché de CloudFront
# Necesitas tener AWS CLI configurado

echo "🔄 Invalidando caché de CloudFront..."

# Obtener el Distribution ID de CloudFront
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[?contains(@, 'master.d1s8c37h7djf3t.amplifyapp.com')]].Id" --output text)

if [ -z "$DISTRIBUTION_ID" ]; then
    echo "❌ No se pudo encontrar el Distribution ID"
    exit 1
fi

echo "�� Distribution ID: $DISTRIBUTION_ID"

# Crear archivo de invalidación
cat > invalidation.json << EOF
{
    "Paths": {
        "Quantity": 1,
        "Items": [
            "/assets/modelos/*"
        ]
    },
    "CallerReference": "$(date +%s)"
}
EOF

# Ejecutar invalidación
aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --invalidation-batch file://invalidation.json

echo "✅ Invalidación iniciada. Puede tomar 5-10 minutos para completarse."
echo "🔍 Puedes verificar el estado con:"
echo "   aws cloudfront list-invalidations --distribution-id $DISTRIBUTION_ID" 
#!/bin/bash

echo "🔄 Invalidando caché de CloudFront..."

# Obtener el Distribution ID de CloudFront
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[?contains(@, 'master.d1s8c37h7djf3t.amplifyapp.com')]].Id" --output text)

if [ -z "$DISTRIBUTION_ID" ]; then
    echo "❌ No se pudo encontrar el Distribution ID"
    echo "🔍 Intentando buscar manualmente..."
    aws cloudfront list-distributions --query "DistributionList.Items[].{Id:Id,Aliases:Aliases.Items}" --output table
    exit 1
fi

echo "✅ Distribution ID encontrado: $DISTRIBUTION_ID"

# Crear archivo de invalidación
cat > invalidation.json << EOF
{
    "Paths": {
        "Quantity": 3,
        "Items": [
            "/assets/modelos/*",
            "/assets/modelos/*.wasm",
            "/*"
        ]
    },
    "CallerReference": "$(date +%s)-$(uuidgen)"
}
EOF

echo "�� Archivo de invalidación creado:"
cat invalidation.json

# Ejecutar invalidación
echo "�� Ejecutando invalidación..."
aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --invalidation-batch file://invalidation.json

echo "✅ Invalidación iniciada. Puede tomar 5-10 minutos para completarse."
echo "🔍 Para verificar el estado:"
echo "   aws cloudfront list-invalidations --distribution-id $DISTRIBUTION_ID" 